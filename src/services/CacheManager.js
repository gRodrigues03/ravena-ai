const Redis = require('ioredis');
const Logger = require('../utils/Logger');

class CacheManager {
  constructor(redisURL, redisDB, redisTTL, maxCacheSize) {
    this.logger = new Logger(`redis`);
    this.redisURL = redisURL;
    this.redisDB = (redisDB ?? 0) % 15;
    this.redisTTL = parseInt(redisTTL, 10) || 3600;
    this.maxCacheSize = parseInt(maxCacheSize, 10) || 100;

    // in-memory fallback
    this.messageCache = [];
    this.contactCache = [];
    this.chatCache = [];

    this.redisClient = null;

    if (this.redisURL) {
      try {
        this.redisClient = new Redis(`${this.redisURL}/${this.redisDB}`, { /* ... options ... */ });
        this.redisClient.on('connect', () => this.logger.info(`CacheManager: Connected to Redis db ${this.redisDB}.`));
        this.redisClient.on('error', (err) => this.logger.error('CacheManager: Redis client error:', err.message));
        // Optional initial ping
        this.redisClient.ping().catch(err => this.logger.warn(`CacheManager: Initial Redis ping failed: ${err.message}.`));
      } catch (error) {
        this.logger.error('CacheManager: Failed to initialize Redis client:', error.message);
        this.redisClient = null;
      }
    } else {
      this.logger.info('CacheManager: No redisURL provided. Using in-memory cache only.');
    }
  }


  async putChatInCache(data) {
    if (!data || !data.id || typeof data.id?._serialized === 'undefined') {
      this.logger.debug('CacheManager (putChatInCache): Invalid chat data.', { data });
      return;
    }
    const chatId = data.id._serialized;
    const redisKey = `chat:${chatId}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(data), 'EX', this.redisTTL);
        return;
      } catch (err) {
        this.logger.error(`CacheManager (putChatInCache): Error caching chat ${chatId} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.chatCache.push(data);
    if (this.chatCache.length > this.maxCacheSize) {
      this.chatCache.shift();
    }
  }

  async getChatFromCache(id) {
    if (typeof id === 'undefined' || id === null) return null;
    const redisKey = `chat:${id}`;

    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisKey);
        if (cachedData) return JSON.parse(cachedData);
      } catch (err) {
        this.logger.error(`CacheManager (getChatFromCache): Error retrieving chat ${id} from Redis: ${err.message}. Falling back.`);
      }
    }
    return this.chatCache.find(m => m.key && m.key.id == id) || null;
  }


  async putMessageInCache(data) {
    if (!data || !data.key || typeof data.key.id === 'undefined') {
      this.logger.error('CacheManager (putMessageInCache): Invalid message data.');
      return;
    }
    const messageId = data.key.id;
    const redisKey = `message:${messageId}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(data), 'EX', this.redisTTL);
        return;
      } catch (err) {
        this.logger.error(`CacheManager (putMessageInCache): Error caching message ${messageId} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.messageCache.push(data);
    if (this.messageCache.length > this.maxCacheSize) {
      this.messageCache.shift();
    }
  }

  async putSentMessageInCache(key) {
    if (!key || !key.id || typeof key.id === 'undefined') {
      this.logger.error('CacheManager (putSentMessageInCache): Invalid message key data.');
      return;
    }
    const messageId = key.id;
    const redisKey = `message:${messageId}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(key), 'EX', this.redisTTL);
        return;
      } catch (err) {
        this.logger.error(`CacheManager (putSentMessageInCache): Error caching message key ${messageId} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.messageCache.push(key);
    if (this.messageCache.length > this.maxCacheSize) {
      this.messageCache.shift();
    }
  }

  async getMessageFromCache(id) {
    if (typeof id === 'undefined' || id === null) return null;
    const redisKey = `message:${id}`;

    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisKey);
        if (cachedData) return JSON.parse(cachedData);
      } catch (err) {
        this.logger.error(`CacheManager (getMessageFromCache): Error retrieving message ${id} from Redis: ${err.message}. Falling back.`);
      }
    }
    return this.messageCache.find(m => m.key && m.key.id == id) || null;
  }

  // V3 Methods
  async putGoMessageInCache(data) {
    if (!data || !data.id) {
      this.logger.error('CacheManager (putGoMessageInCache): Invalid message data (missing id).');
      return;
    }
    const messageId = data.id;
    const redisKey = `message:${messageId}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(data), 'EX', this.redisTTL);
        return;
      } catch (err) {
        this.logger.error(`CacheManager (putGoMessageInCache): Error caching message ${messageId} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.messageCache.push(data);
    if (this.messageCache.length > this.maxCacheSize) {
      this.messageCache.shift();
    }
  }

  async getGoMessageFromCache(id) {
    if (typeof id === 'undefined' || id === null) return null;
    const redisKey = `message:${id}`;

    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisKey);
        if (cachedData) return JSON.parse(cachedData);
      } catch (err) {
        this.logger.error(`CacheManager (getGoMessageFromCache): Error retrieving message ${id} from Redis: ${err.message}. Falling back.`);
      }
    }
    return this.messageCache.find(m => m.id == id || (m.key && m.key.id == id)) || null;
  }

  async putContactInCache(data) {
    if (!data || typeof data.number === 'undefined') {
      //this.logger.error('CacheManager (putContactInCache): Invalid contact data.');
      return;
    }
    const contactNumber = data.number;
    const redisKey = `contact:${contactNumber}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(data), 'EX', this.redisTTL);
        return;
      } catch (err) {
        this.logger.error(`CacheManager (putContactInCache): Error caching contact ${contactNumber} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.contactCache.push(data);
    if (this.contactCache.length > this.maxCacheSize) {
      this.contactCache.shift();
    }
  }

  async getContactFromCache(id) {
    if (typeof id === 'undefined' || id === null) return null;
    const redisKey = `contact:${id}`;

    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisKey);
        if (cachedData) return JSON.parse(cachedData);
      } catch (err) {
        this.logger.error(`CacheManager (getContactFromCache): Error retrieving contact ${id} from Redis: ${err.message}. Falling back.`);
      }
    }
    return this.contactCache.find(c => c.number == id) || null;
  }
}

module.exports = CacheManager;
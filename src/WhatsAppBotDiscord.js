const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomBytes } = require('crypto');
const { promisify } = require('util');

const DiscordApiClient = require('./services/DiscordApiClient');
const CacheManager = require('./services/CacheManager');
const ReturnMessage = require('./models/ReturnMessage');
const ReactionsHandler = require('./ReactionsHandler');
const LLMService = require('./services/LLMService');
const MentionHandler = require('./MentionHandler');
const AdminUtils = require('./utils/AdminUtils');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem');
const Database = require('./utils/Database');
const LoadReport = require('./LoadReport');
const Logger = require('./utils/Logger');

// Utils
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);

class WhatsAppBotDiscord {
  constructor(options) {
    if (!options.useDiscord) {
      throw new Error("WhatsAppBotDiscord: 'useDiscord' option must be true.");
    }
    if (!options.discordToken) {
      throw new Error("WhatsAppBotDiscord: 'discordToken' is required.");
    }

    this.id = options.id;
    this.eventHandler = options.eventHandler;
    this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
    this.logger = new Logger(`bot-discord-${this.id}`);

    // Opções específicas do Discord
    this.discordToken = options.discordToken;
    this.apiClient = new DiscordApiClient(this.discordToken);
    this.discordClient = this.apiClient.getClient();

    // Opções existentes adaptadas
    this.pvAI = options.pvAI !== undefined ? options.pvAI : true;
    this.ignorePV = options.ignorePV || false;
    this.grupoLogs = options.grupoLogs; // Espera-se um Channel ID
    this.grupoAvisos = options.grupoAvisos; // Espera-se um Channel ID
    this.notificarDonate = options.notificarDonate;

    this.version = "Discord";
    this.wwebversion = require('discord.js').version;

    // --- Caches e Handlers (mantidos para compatibilidade) ---
    this.redisURL = options.redisURL;
    this.redisDB = options.redisDB || 1; // Usar um DB diferente do Evo para evitar conflitos
    this.redisTTL = options.redisTTL || 604800;
    this.maxCacheSize = 3000;

    this.messageCache = [];
    this.contactCache = [];
    this.sentMessagesCache = [];
    this.cacheManager = new CacheManager(
      this.redisURL,
      this.redisDB,
      this.redisTTL,
      this.maxCacheSize
    );

    this.database = Database.getInstance();
    this.isConnected = false;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    
    this.whitelist = options.whitelistPV || [];
    
    this.mentionHandler = new MentionHandler();
    this.lastMessageReceived = Date.now();
    this.startupTime = Date.now();
    
    this.loadReport = new LoadReport(this);
    this.reactionHandler = new ReactionsHandler();
    this.llmService = new LLMService({});
    this.adminUtils = AdminUtils.getInstance();

    // --- Placeholders para sistemas não aplicáveis ---
    this.inviteSystem = new InviteSystem(this); // Pode ser adaptado no futuro
    this.streamSystem = null; // new StreamSystem(this);
    
    // --- Client Fake para manter a compatibilidade ---
    this.client = {
      getChatById: (arg) => this.getChatDetails(arg),
      getContactById: (arg) => this.getContactDetails(arg),
      getInviteInfo: (arg) => this.inviteInfo(arg),
      getMessageById: async (messageId) => this.recoverMsgFromCache(messageId),
      setStatus: (arg) => this.updateProfileStatus(arg),
      // Funções não aplicáveis
      leaveGroup: (arg) => this.leaveGroup(arg),
      setProfilePicture: (arg) => this.updateProfilePicture(arg),
      setPrivacySettings: (arg) => this.updatePrivacySettings(arg),
      acceptInvite: (arg) => this.acceptInviteCode(arg),
      sendPresenceUpdate: async () => true,
      info: {
        wid: {
          _serialized: this.discordClient.user ? this.discordClient.user.id : 'discord-bot'
        }
      }
    };
  }

  async initialize() {
    this.logger.info(`[${this.id}] Initializing Discord bot...`);
    this.database.registerBotInstance(this);
    this.startupTime = Date.now();

    this.logger.info('Registering Discord event listeners...');

    this.discordClient.on('ready', () => {
      this.isConnected = true;
      this.logger.info(`>>> SUCESSO! Bot ${this.id} (${this.discordClient.user.tag}) está conectado ao Discord! <<<`);
      if (this.eventHandler && typeof this.eventHandler.onConnected === 'function') {
        this.eventHandler.onConnected(this);
      }
      this._sendStartupNotifications();
    });

    this.discordClient.on('messageCreate', this._handleMessage.bind(this));
    this.discordClient.on('guildCreate', this._handleGroupJoin.bind(this));
    this.discordClient.on('guildMemberAdd', this._handleParticipantUpdate.bind(this));
    
    this.discordClient.on('error', (error) => {
        this.logger.error("!!! ERRO DO CLIENTE DISCORD !!!", error);
    });
    this.discordClient.on('warn', (warning) => {
        this.logger.warn("!!! AVISO DO CLIENTE DISCORD !!!", warning);
    });

    try {
      await this.apiClient.connect();
    } catch (error) {
      this.logger.error(`Error during Discord login for instance ${this.id}:`, error);
      this.isConnected = false;
    }

    return this;
  }

  async _handleMessage(message) {
    if (message.author.bot) return; // Ignorar mensagens de outros bots (e de si mesmo)

    this.logger.debug(`_handleMessage`, message);
    this.lastMessageReceived = Date.now();

    // Filtro de grupos do sistema (se configurado)
    if (message.channel.id === this.grupoLogs) {
        this.logger.debug(`[${this.id}] Ignoring message from system channel: ${message.channel.id}`);
        return;
    }

    try {
      const formattedMessage = await this.formatMessageFromDiscord(message);
      if (formattedMessage && this.eventHandler && typeof this.eventHandler.onMessage === 'function') {
        this.eventHandler.onMessage(this, formattedMessage);
      }
    } catch (e) {
      this.logger.error(`[messageCreate] Erro formatando mensagem do Discord`, message.id, e);
    }
  }

  async _handleGroupJoin(guild) {
    this.logger.info(`Bot foi adicionado a um novo servidor: ${guild.name} (${guild.id})`);
    // Simula o evento de entrada em grupo
    if (this.eventHandler && typeof this.eventHandler.onGroupJoin === 'function') {
        const mockGroupNotification = {
            id: {
                server: 'g.us', // sufixo de grupo
                user: guild.ownerId,
                _serialized: `${guild.id}@g.us`
            },
            body: `Bot foi adicionado ao servidor ${guild.name}`,
            type: 'add',
            author: guild.ownerId, // Quem adicionou? Não temos essa info, usamos o dono.
            chatId: guild.id,
            recipientIds: [this.discordClient.user.id]
        };
        this.eventHandler.onGroupJoin(this, mockGroupNotification);
    }
  }

  async _handleParticipantUpdate(member) {
    this.logger.info(`Novo membro '${member.user.tag}' entrou no servidor '${member.guild.name}'`);
    // Simula a atualização de participantes
    if (this.eventHandler && typeof this.eventHandler.onParticipantsUpdate === 'function') {
        const mockParticipantUpdate = {
            id: {
                server: 'g.us',
                user: member.id,
                _serialized: `${member.guild.id}@g.us`
            },
            body: ``,
            type: 'add',
            author: member.id, // O próprio usuário que entrou
            chatId: member.guild.id,
            recipientIds: [member.id]
        };
        this.eventHandler.onParticipantsUpdate(this, mockParticipantUpdate);
    }
  }

  async formatMessageFromDiscord(message, skipCache = false) {
    try {
      if (!message || !message.id) {
        this.logger.warn(`[formatMessageFromDiscord] Objeto de mensagem inválido recebido.`);
        return null;
      }

      const isGroup = message.inGuild();
      const authorId = message.author.id;
      const channelId = message.channel.id;
      const timestamp = Math.floor(message.createdTimestamp / 1000);
      const responseTime = Math.max(0, this.getCurrentTimestamp() - timestamp);

      this.loadReport.trackReceivedMessage(isGroup, responseTime, authorId);

      let type = 'text';
      let content = message.content;
      let caption = null;
      let mediaInfo = null;

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        const mimeType = attachment.contentType || 'application/octet-stream';

        if (mimeType.startsWith('image/')) type = 'image';
        else if (mimeType.startsWith('video/')) type = 'video';
        else if (mimeType.startsWith('audio/')) type = 'audio';
        else type = 'document';

        mediaInfo = {
          isMessageMedia: true,
          mimetype: mimeType,
          url: attachment.url,
          filename: attachment.name,
          size: attachment.size,
        };
        content = mediaInfo;
        caption = message.content; // No Discord, o texto acompanha o anexo
      }

      const formattedMessage = {
        discordMessage: message,
        id: message.id,
        fromMe: message.author.id === this.discordClient.user.id,
        group: isGroup ? channelId : null,
        from: channelId, // No Discord, 'from' é o canal
        author: authorId,
        name: message.member ? message.member.displayName : message.author.username,
        authorName: message.member ? message.member.displayName : message.author.username,
        pushname: message.author.username,
        type: type,
        content: content,
        body: message.content, // O corpo do texto, sempre
        mentions: message.mentions.users.map(u => u.id),
        caption: caption,
        origin: {},
        responseTime: responseTime,
        timestamp: timestamp,
        key: { id: message.id, remoteJid: channelId, fromMe: message.author.id === this.discordClient.user.id },
        hasMedia: !!mediaInfo,

        getContact: async () => this.getContactDetails(authorId),
        getChat: async () => this.getChatDetails(channelId),
        delete: async () => message.delete(),
        downloadMedia: async () => {
          if (mediaInfo && mediaInfo.url) {
            const response = await axios.get(mediaInfo.url, { responseType: 'arraybuffer' });
            const base64Data = Buffer.from(response.data, 'binary').toString('base64');
            return {
              mimetype: mediaInfo.mimetype,
              data: base64Data,
              filename: mediaInfo.filename,
              source: 'file',
              isMessageMedia: true
            };
          }
          return null;
        }
      };

      formattedMessage.origin = {
        id: { _serialized: message.id },
        author: authorId,
        from: channelId,
        react: (emoji) => message.react(emoji),
        getContact: formattedMessage.getContact,
        getChat: formattedMessage.getChat,
        getQuotedMessage: async () => {
          if (message.reference && message.reference.messageId) {
            const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
            return await this.formatMessageFromDiscord(referencedMessage);
          }
          return null;
        },
        delete: async () => message.delete(),
        body: content,
      };

      if (!skipCache) {
        this.cacheManager.putMessageInCache(formattedMessage);
      }
      
      return formattedMessage;

    } catch (error) {
      this.logger.error(`[formatMessageFromDiscord] Erro ao formatar mensagem:`, error, message);
      return null;
    }
  }

  async sendMessage(chatId, content, options = {}) {
    this.logger.debug(`[sendMessage] to ${chatId} (Type: ${typeof content})`, options);
    try {
      const isGroup = !!(await this.discordClient.channels.fetch(chatId)).guild;
      this.loadReport.trackSentMessage(isGroup);

      if (this.safeMode) {
        this.logger.info(`[SAFE MODE] Would send to ${chatId}: ${typeof content === 'string' ? content.substring(0, 70) + '...' : '[Media/Object]'}`);
        return { id: { _serialized: `safe-mode-msg-${randomBytes(8).toString('hex')}` }, ack: 0, body: content };
      }

      if (!this.isConnected) {
        throw new Error('Not connected to Discord');
      }

      const channel = await this.discordClient.channels.fetch(chatId);
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${chatId} not found or is not a text channel.`);
      }

      let discordPayload = {};
      let sentMessage;

      // --- Tratamento de Conteúdo ---
      if (typeof content === 'string') {
        discordPayload.content = content;
      } else if (content.isMessageMedia || (content.mimetype && (content.data || content.url))) {
        let fileBuffer;
        if (content.data) {
          fileBuffer = Buffer.from(content.data, 'base64');
        } else if (content.url) {
          const response = await axios.get(content.url, { responseType: 'arraybuffer' });
          fileBuffer = Buffer.from(response.data, 'binary');
        } else {
          throw new Error("Media content must have 'data' (base64) or 'url'.");
        }
        
        const attachment = new AttachmentBuilder(fileBuffer, { name: content.filename || 'file.dat' });
        discordPayload.files = [attachment];
        if (options.caption) {
          discordPayload.content = options.caption;
        }
      } else if (content.isLocation) {
        discordPayload.content = `📍 **Localização**: ${content.description || ''}
https://www.google.com/maps/search/?api=1&query=${content.latitude},${content.longitude}`;
      } else {
        this.logger.error(`[sendMessage] Unhandled content type for Discord.`, content);
        return;
      }

      // --- Tratamento de Opções ---
      if (options.mentions && options.mentions.length > 0) {
        const mentionStrings = options.mentions.map(id => `<@${id.split('@')[0]}>`).join(' ');
        discordPayload.content = `${discordPayload.content || ''} ${mentionStrings}`;
      }

      if (options.quotedMsgId) {
        const quoteId = typeof options.quotedMsgId === 'string' ? options.quotedMsgId.split('_').pop() : options.quotedMsgId;
        discordPayload.reply = { messageReference: quoteId, failIfNotExists: false };
      }

      sentMessage = await channel.send(discordPayload);

      return {
        id: { _serialized: sentMessage.id },
        ack: 3, // No Discord, se não deu erro, foi entregue e lida (visível no canal)
        body: content,
        _data: sentMessage
      };

    } catch (error) {
      this.logger.error(`[sendMessage] Error sending message to ${chatId}:`, error);
      throw error;
    }
  }

  async sendReturnMessages(returnMessages) {
    if (!Array.isArray(returnMessages)) {
      returnMessages = [returnMessages];
    }
    const validMessages = returnMessages.filter(msg => msg && msg.isValid && msg.isValid());
    if (validMessages.length === 0) return [];
    
    const results = [];
    for (const message of validMessages) {
      if (message.delay > 0) await sleep(message.delay);
      
      try {
        const result = await this.sendMessage(message.chatId, message.content, message.options);
        results.push(result);

        if (message.reaction && result && result.id?._serialized) {
          try {
            const channel = await this.discordClient.channels.fetch(message.chatId);
            const sentMessage = await channel.messages.fetch(result.id._serialized);
            await sentMessage.react(message.reaction);
          } catch (reactError) {
            this.logger.error(`[sendReturnMessages] Erro enviando reaction "${message.reaction}" para ${result.id._serialized}:`, reactError);
          }
        }
      } catch(sendError) {
        this.logger.error(`[sendReturnMessages] Falha enviando ReturnMessages para ${message.chatId}:`, sendError);
        results.push({ error: sendError, messageContent: message.content });
      }
    }
    return results;
  }

  async destroy() {
    this.logger.info(`[destroy] Desligando o bot do Discord ${this.id}...`);
    if (this.discordClient) {
        await this.discordClient.destroy();
    }
    this.isConnected = false;
    this.logger.info(`[destroy] Bot do Discord ${this.id} foi desligado.`);
  }

  // --- Funções de Detalhes (Simuladas) ---

  async getContactDetails(userId) {
    try {
      const user = await this.discordClient.users.fetch(userId);
      return {
        id: { _serialized: user.id },
        name: user.globalName || user.username,
        pushname: user.username,
        number: user.id,
        isUser: true,
        picture: user.displayAvatarURL(),
      };
    } catch (error) {
      this.logger.warn(`[getContactDetails] Não foi possível encontrar o usuário ${userId}.`);
      return { id: { _serialized: userId }, name: 'Usuário Desconhecido', isUser: true, _isPartial: true };
    }
  }

  async getChatDetails(channelId) {
    try {
      const channel = await this.discordClient.channels.fetch(channelId);
      if (channel.isDMBased()) {
        return {
          id: { _serialized: channel.id },
          name: channel.recipient ? channel.recipient.username : 'DM',
          isGroup: false,
        };
      }
      return {
        id: { _serialized: channel.id },
        name: channel.name,
        isGroup: true,
        participants: channel.guild.members.cache.map(m => ({
          id: { _serialized: m.id },
          isAdmin: m.permissions.has('Administrator'),
        })),
      };
    } catch (error) {
      this.logger.warn(`[getChatDetails] Não foi possível encontrar o canal ${channelId}.`);
      return { id: { _serialized: channelId }, name: 'Canal Desconhecido', _isPartial: true };
    }
  }

  // --- Funções de Mídia (Simuladas) ---

  async createMedia(filePath) {
    const data = await readFileAsync(filePath, { encoding: 'base64' });
    const filename = path.basename(filePath);
    const mimetype = require('mime-types').lookup(filePath) || 'application/octet-stream';
    return { mimetype, data, filename, isMessageMedia: true };
  }

  async createMediaFromURL(url, options = {}) {
    const filename = path.basename(new URL(url).pathname) || 'media_from_url';
    const mimetype = require('mime-types').lookup(url.split("?")[0]) || 'application/octet-stream';
    return { url, mimetype, filename, isMessageMedia: true };
  }

  // --- Funções de Cache (Mantidas) ---
  
  recoverMsgFromCache(messageId) {
    return this.cacheManager.getMessageFromCache(messageId);
  }

  // --- Funções de Notificação (Adaptadas) ---

  async _sendStartupNotifications() {
    if (this.grupoAvisos) {
      const msg = new ReturnMessage(this.grupoAvisos, `✅ Bot Discord '${this.id}' conectado e operando!`);
      this.sendReturnMessages(msg);
    }
  }

  // --- Funções NÃO IMPLEMENTADAS / PLACEHOLDERS ---

  _unimplemented(methodName) {
    this.logger.warn(`[${this.id}] Método '${methodName}' não é aplicável ou implementado para Discord.`);
    return Promise.resolve(true);
  }

  async logout() { return this._unimplemented('logout'); }
  async deleteInstance() { return this._unimplemented('deleteInstance'); }
  async createInstance() { return this._unimplemented('createInstance'); }
  async recreateInstance() { return this._unimplemented('recreateInstance'); }
  async sendReaction(chatId, messageId, emoji) {
    try {
        const channel = await this.discordClient.channels.fetch(chatId);
        const msg = await channel.messages.fetch(messageId);
        await msg.react(emoji);
        return true;
    } catch (e) {
        this.logger.error(`[sendReaction] Falha ao reagir à mensagem ${messageId} em ${chatId}`, e);
        return false;
    }
  }
  async updateProfileStatus(status) {
    try {
        this.discordClient.user.setActivity(status);
        return true;
    } catch(e) {
        this.logger.error(`[updateProfileStatus] Falha ao definir status:`, e);
        return false;
    }
  }
  
  
  // --- Métodos de Grupo/Instância (Não aplicáveis) ---
  async getBase64FromMediaMessage(msg) { return this._unimplemented('getBase64FromMediaMessage'); }
  async sendContact(chatId, contact) { return this._unimplemented('sendContact'); }
  async sendPoll(chatId, poll) { return this._unimplemented('sendPoll'); }
  async updateGroupSubject(chatId, title) { return this._unimplemented('updateGroupSubject'); }
  async leaveGroup(groupId) { return this._unimplemented('leaveGroup'); }
  async acceptInviteCode(code) { return this._unimplemented('acceptInviteCode'); }
  async inviteInfo(code) { return this._unimplemented('inviteInfo'); }
  async updatePrivacySettings(settings) { return this._unimplemented('updatePrivacySettings'); }
  async updateProfilePicture(pic) { return this._unimplemented('updateProfilePicture'); }
  
  // --- Funções Utilitárias ---
  getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
  }
}

module.exports = WhatsAppBotDiscord;

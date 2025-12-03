/**
 * Test script for WhatsApp bot
 * 
 * This script simulates events to test the bot without connecting to WhatsApp
 */
// Load environment variables
require('dotenv').config();

const EventEmitter = require('events');
const WhatsAppBot = require('./src/WhatsAppBot');
const EventHandler = require('./src/EventHandler');
const Logger = require('./src/utils/Logger');

// Create logger for test script
const logger = new Logger('test');

// Mock the whatsapp-web.js Client class
class MockClient extends EventEmitter {
  constructor() {
    super();
    this.info = { 
      wid: { 
        _serialized: '1234567890@c.us' 
      } 
    };
    this.getBlockedContacts = () => ([]);
  }

  async initialize() {
    logger.info('Mock client initialized');
    // Emit authenticated and ready events immediately
    setTimeout(() => {
      this.emit('authenticated');
      this.emit('ready');
    }, 100);
    return this;
  }

  async destroy() {
    logger.info('Mock client destroyed');
    return this;
  }

  async sendMessage(chatId, content, options = {}) {
    logger.info(`Sending message to ${chatId}: ${typeof content === 'string' ? content : '[Media]'}`);
    logger.debug('Message options:', options);
    return { id: { _serialized: 'mock-msg-id' } };
  }

  async sendPresenceUpdate(status, chatId) {
    logger.info(`Updating presence for ${chatId}: ${status}`);
  }
}

// Create a mock version of WhatsAppBot
class MockWhatsAppBot extends WhatsAppBot {
  constructor(options) {
    super(options);
  }
  
  // Override the initialize method
  async initialize() {
    this.logger.info(`Initializing bot instance ${this.id}`);
    
    // Create mock client
    this.client = new MockClient();
    
    // Register event handlers
    this.registerEventHandlers();
    
    // Emit the ready event after a short delay
    setTimeout(() => {
      this.client.emit('authenticated');
      this.client.emit('ready');
    }, 100);
    
    this.logger.info(`Bot ${this.id} initialized`);
    return this;
  }
}

// Helper class to simulate events
class BotSimulator {
  constructor(bot) {
    this.bot = bot;
    this.logger = new Logger('simulator');
  }

  // Simulate a text message
  async simulateTextMessage(fromId, groupId, text) {
    this.logger.info(`Simulating text message from ${fromId} in group ${groupId || 'private'}: ${text}`);
    
    // Create mock message object
    const message = {
      id: { _serialized: `mock-msg-${Date.now()}` },
      body: text,
      from: fromId,
      to: groupId || this.bot.client.info.wid._serialized,
      hasMedia: false,
      type: 'chat',
      
      // Mock methods
      getChat: async () => ({
        id: { _serialized: groupId || fromId },
        name: groupId ? 'Test Group' : 'Test User',
        isGroup: !!groupId
      }),
      getContact: async () => ({
        id: { _serialized: fromId },
        pushname: 'Test User'
      }),
      downloadMedia: async () => null,
      react: async (emoji) => {
        this.logger.info(`Reacted with ${emoji} to message`);
      },
      delete: async () => {
        this.logger.info(`Deleted message`);
      },
      getQuotedMessage: async () => null,
      quotedMsg: null
    };
    
    // Emit message event
    this.bot.client.emit('message', message);
    return message;
  }
}

// Main test function
async function runTests() {
  try {
    // Create event handler and bot
    const eventHandler = new EventHandler();
    const bot = new MockWhatsAppBot({
      id: 'test-bot',
      phoneNumber: '1234567890',
      eventHandler,
      prefix: '!',
      evolutionApiUrl: "http://localhost",
      evolutionApiKey: "12345",
      evoInstanceName: "mockup",
      instanceName: "mockup",
      webhookHost: "http://localhost"
    });
    
    // Initialize bot and database
    await bot.initialize();
    
    // Wait for the bot to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (!bot.client || !bot.client.info || !bot.client.info.wid) {
      throw new Error('Bot client or client.info.wid is undefined after initialization');
    }
    
    // Create simulator
    const simulator = new BotSimulator(bot);
    
    // Run example tests
    const testUser = '55123456789@c.us';
    const testGroup = '120363404335114899@g.us';
    
    // First, we need to ensure the database has the test group
    logger.info('Setting up test environment...');
    
    // Test: Simulating sticker commands with images
    //logger.info('TEST: Sending image with sq command');
    // First image message
    //const imageMessage = await simulator.simulateImageMessage(testUser, testGroup, '!sbg');
    
    // // Wait for message processing
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // // Test another sticker command
    // logger.info('TEST: Sending image with sqc command');
    // await simulator.simulateImageMessage(testUser, testGroup, '!sqc Teste 2');
    
    // // Wait for message processing
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // // Test with quoted message
    // logger.info('TEST: Sending message that quotes an image for sqb command');
     //await simulator.simulateTextMessage(testUser, testGroup, '!sbg', imageMessage);
    
    // // Wait for message processing
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // // Test video processing
    // logger.info('TEST: Sending video with sq command');
    // await simulator.simulateVideoMessage(testUser, testGroup, '!sq Video teste');
    
    // // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    logger.info('sending');

    await simulator.simulateTextMessage(testUser, testGroup, '!imagine batata frita');

    //logger.info('joining');    
    //await simulator.simulateGroupJoin(testGroup, testUser);
    
    logger.info('All tests completed successfully');
  } catch (error) {
    logger.error('Error running tests:', error);
  }
}

// Run the tests
runTests().catch(console.error);
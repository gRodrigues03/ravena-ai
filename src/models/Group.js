/**
 * Modelo Group representando um grupo do WhatsApp com propriedades e configurações
 */
class Group {
  /**
   * Cria uma nova instância de Group
   * @param {Object} data - Dados do grupo
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.addedBy = data.addedBy || null;
    this.removedBy = data.removedBy || false;
    this.name = data.name || (this.id ? this.id.split('@')[0].toLowerCase().replace(/\s+/g, '').substring(0, 16) : null);
    this.prefix = data.prefix || '!';
    this.customIgnoresPrefix = data.customIgnoresPrefix || false;
    this.inviteCode = data.inviteCode || null;
    this.paused = data.paused || false;
    this.additionalAdmins = data.additionalAdmins || [];
    
    // Filtros
    this.filters = data.filters || {
      links: false,
      words: [],
      people: []
    };
    
    // Monitoramento de plataformas
    this.twitch = data.twitch || [];
    this.kick = data.kick || [];
    this.youtube = data.youtube || [];
    this.botNotInGroup = data.botNotInGroup || [];

    // Mensagens de boas-vindas e despedida
    this.greetings = data.greetings || {};
    this.farewells = data.farewells || {};

    // Interacoes Auto
    this.interact = data.interact || {
      enabled: true,
      useCmds: true,
      lastInteraction: 0,
      cooldown: 30,
      chance: 100,
    };

    // Outras config
    this.autoStt = data.autoStt || false;
    this.ignoredNumbers = data.ignoredNumbers || [];
    this.ignoredUsers = data.ignoredUsers || [];
    this.mutedStrings = data.mutedStrings || [];
    this.mutedCategories = data.mutedCategories || [];
    this.nicks = data.nicks || [];
    this.customAIPrompt = data.customAIPrompt || [];
    
    // Metadados
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Atualiza propriedades do grupo
   * @param {Object} data - Novos dados do grupo
   */
  update(data) {
    // Atualiza apenas propriedades fornecidas
    if (data.name) this.name = data.name;
    if (data.prefix) this.prefix = data.prefix;
    if (data.customIgnoresPrefix) this.customIgnoresPrefix = data.customIgnoresPrefix;
    if (data.inviteCode) this.inviteCode = data.inviteCode;
    if (typeof data.paused === 'boolean') this.paused = data.paused;
    if (data.additionalAdmins) this.additionalAdmins = data.additionalAdmins;
    
    // Atualiza filtros se fornecidos
    if (data.filters) {
      this.filters = {
        ...this.filters,
        ...data.filters
      };
    }
    
    // Atualiza monitoramento de plataformas
    if (data.twitch) this.twitch = data.twitch;
    if (data.kick) this.kick = data.kick;
    if (data.youtube) this.youtube = data.youtube;
    
    // Not in group
    if (data.botNotInGroup) this.botNotInGroup = data.botNotInGroup;

    // Atualiza boas-vindas
    if (data.greetings) {
      this.greetings = {
        ...this.greetings,
        ...data.greetings
      };
    }
    
    // Atualiza despedidas
    if (data.farewells) {
      this.farewells = {
        ...this.farewells,
        ...data.farewells
      };
    }
    
    // Atualiza interações automáticas
    if (data.interact) {
      this.interact = {
        ...this.interact,
        ...data.interact
      };
    }
    
    // Atualiza outras configurações
    if (typeof data.autoStt === 'boolean') this.autoStt = data.autoStt;
    if (data.ignoredNumbers) this.ignoredNumbers = data.ignoredNumbers;
    if (data.ignoredUsers) this.ignoredUsers = data.ignoredUsers;
    if (data.mutedStrings) this.mutedStrings = data.mutedStrings;
    if (data.nicks) this.nicks = data.nicks;
    if (data.customAIPrompt) this.customAIPrompt = data.customAIPrompt;
    
    // Atualiza carimbos de data/hora
    this.updatedAt = Date.now();
  }
}

module.exports = Group;
const CommandHandler = require('./CommandHandler');
const Database = require('./utils/Database');
const Group = require('./models/Group');
const Logger = require('./utils/Logger');
const AdminUtils = require('./utils/AdminUtils');
const CustomVariableProcessor = require('./utils/CustomVariableProcessor');
const LLMService = require('./services/LLMService');
const SpeechCommands = require('./functions/SpeechCommands');
const { aiCommand } = require('./functions/AICommands');
const SummaryCommands = require('./functions/SummaryCommands');
const NSFWPredict = require('./utils/NSFWPredict');
const MuNewsCommands = require('./functions/MuNewsCommands');
const HoroscopoCommands = require('./functions/HoroscopoCommands');
const RankingMessages = require('./functions/RankingMessages');
const fs = require('fs').promises;
const path = require('path');
const Stickers = require('./functions/Stickers');
const GeoGuesser = require('./functions/GeoguesserGame');

class EventHandler {
  constructor() {
    this.logger = new Logger('event-handler');
    this.database = Database.getInstance();
    this.commandHandler = new CommandHandler();
    this.llmService = new LLMService({});
    this.variableProcessor = new CustomVariableProcessor();
    this.nsfwPredict = NSFWPredict.getInstance();
    this.adminUtils = AdminUtils.getInstance();
    this.rankingMessages = RankingMessages;
    this.userGreetingManager = require('./utils/UserGreetingManager').getInstance();
    this.groups = {};
    this.comandosWhitelist = process.env.CMD_WHITELIST ? process.env.CMD_WHITELIST.split(",") : ["sa-", "anoni"];

    this.logger.info(`[EventHandler] CmdWhitelist:`, this.comandosWhitelist);
    this.loadGroups();
  }

  /**
   * Carrega todos os grupos do banco de dados
   */
  async loadGroups() {
    try {
      const groups = await this.database.getGroups();
      if (groups && Array.isArray(groups)) {
        for (const groupData of groups) {
          this.groups[groupData.id] = new Group(groupData);
        }
      }
      this.logger.info(`Carregados ${Object.keys(this.groups).length} grupos`);
    } catch (error) {
      this.logger.error('Erro ao carregar grupos:', error);
    }
  }

  /**
   * Obtém grupo por ID, cria se não existir
   * @param {string} groupId - O ID do grupo
   * @param {string} name - O nome do grupo (opcional)
   * @returns {Promise<Group>} - O objeto do grupo
   */
  async getOrCreateGroup(groupId, name = null, prefix = "?") {
    try {
      if (!this.groups[groupId]) {
        this.logger.info(`Criando novo grupo: ${groupId} com nome: ${name || 'desconhecido'}`);
        
        // Obtém grupos do banco de dados para garantir que temos o mais recente
        const groups = await this.database.getGroups();
        const existingGroup = Array.isArray(groups) ? 
          groups.find(g => g.id === groupId) : null;
        
        if (existingGroup) {
          this.logger.info(`Grupo existente encontrado no banco de dados: ${groupId}`);
          this.groups[groupId] = new Group(existingGroup);
        } else {
          // Cria novo grupo
          let displayName = name || 
            (groupId.split('@')[0].toLowerCase().replace(/\s+/g, '').substring(0, 16));
          

          // Verifica se já tem grupo com esse nome antes
          let grupoExistente = await this.database.getGroupByName(displayName);
          while(grupoExistente){
            const rndG = Math.floor(Math.random() * 100);
            this.logger.info(`[getOrCreateGroup] Tentei criar grupo '${displayName}', tentando agora '${displayName}${rndG}', mas já existe um!`, grupoExistente);
            displayName = `${displayName}${rndG}`;
            grupoExistente = await this.database.getGroupByName(displayName);            
          }

          const group = new Group({
            id: groupId,
            name: displayName,
            prefix: prefix,
            addedBy: "test@c.us" // Para teste
          });
          
          this.groups[groupId] = group;
          
          // Salva no banco de dados
          const saveResult = await this.database.saveGroup(group);
          this.logger.debug(`Resultado de salvamento do grupo: ${saveResult ? 'sucesso' : 'falha'}`);
        }
      }
      return this.groups[groupId];
    } catch (error) {
      this.logger.error('Erro em getOrCreateGroup:', error);
      // Cria um objeto de grupo básico se tudo falhar
      return new Group({ id: groupId, name: name || 'grupo-desconhecido' });
    }
  }

  /**
   * Manipula evento de conexão
   * @param {WhatsAppBot} bot - A instância do bot
   */
  onConnected(bot) {
    this.logger.info(`Bot ${bot.id} conectado`);
  }

  /**
   * Manipula evento de desconexão
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {string} reason - Motivo da desconexão
   */
  onDisconnected(bot, reason) {
    this.logger.info(`Bot ${bot.id} desconectado: ${reason}`);
  }

  /**
   * Manipula evento de mensagem
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   */
  onMessage(bot, message) {
    // Processa mensagem sem aguardar para evitar bloquear a thread de eventos
    this.processMessage(bot, message).catch(error => {
      this.logger.error('Erro em processMessage:', error);
    });
  }

  /**
   * Processa uma mensagem recebida
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   */
  async processMessage(bot, message) {
    try {
      let ignorePV = bot.ignorePV && bot.notInWhitelist(message.author) && message.group === null; 

      // Verifica links de convite em chats privados
      if (!message.group && !ignorePV) {
        // Verifica se é uma mensagem de link de convite
        if(!bot.ignoreInvites && bot.inviteSystem){
          const isInviteHandled = await bot.inviteSystem.processMessage(message);
          if (isInviteHandled) return;
          
          // Verifica se é uma mensagem de acompanhamento para um convite
          const isFollowUpHandled = await bot.inviteSystem.processFollowUpMessage(message);
          if (isFollowUpHandled) return;
        }
      }
      
      // Processa saudação para novos usuários no PV
      //this.userGreetingManager.processGreeting(bot, message);
      
      // Obtém conteúdo de texto da mensagem (corpo ou legenda)
      const textContent = message.type === 'text' ? message.content : message.caption;

      // Se mensagem de grupo, obtém ou cria o grupo
      let group = null;


      if (message.group) {
        // Armazena mensagem para histórico de conversação
        SummaryCommands.storeMessage(message, message.group);

        group = await this.getOrCreateGroup(message.guildId ?? message.group, null, bot.prefix);
        if(!group.botNotInGroup){
          group.botNotInGroup = [];
        } else {
          // Verifica se o bot está marcada como fora do grupo - se ele recebeu msg aqui, é pq tá dentro!
          if(group.botNotInGroup.includes(bot.id)){
            this.logger.info(`[processMessage] O bot '${bot.id}' estava como fora do grupo '${group.name}', mas recebeu mensagem - atualizando`);
            group.botNotInGroup = group.botNotInGroup.filter(b => b !== bot.id);
            await this.database.saveGroup(group);
          }
        }
        
        
        // Verifica apelido do usuário e atualiza o nome se necessário
        if (group.nicks && Array.isArray(group.nicks)) {
          const nickData = group.nicks.find(nick => nick.numero === message.author);
          if (nickData && nickData.apelido) {
            try {
              // Obtém o contato e atualiza o nome em message para uso em comandos
              const contact = await message.origin.getContact();
              // Salva o nome original para possível uso futuro
              if (!message.originalName) {
                message.originalName = contact.name || contact.pushname || 'Desconhecido';
              }
              // Atualiza o nome com o apelido
              contact.name = nickData.apelido;
              contact.pushname = nickData.apelido;
              
              // Atualiza também o nome no objeto message para uso em comandos
              message.authorName = nickData.apelido;
            } catch (error) {
              this.logger.error('Erro ao aplicar apelido:', error);
            }
          }
        }
        

        // Verifica se o grupo está pausado
        if (group.paused) {        
          
          // Verifica se é o comando g-pausar antes de ignorar completamente
          const prefix = (group && group.prefix !== undefined) ? group.prefix : bot.prefix;
          const isPauseCommand = textContent && 
                               textContent.startsWith(prefix) && 
                               textContent.substring(prefix.length).startsWith('g-pausar');
          
          // Só continua o processamento se for o comando g-pausar
          if (!isPauseCommand) {
            return;
          }
        }
        
        // Processa mensagem para ranking
        try {
          await this.rankingMessages.processMessage(message);
        } catch (error) {
          this.logger.error('Erro ao processar mensagem para ranking:', error);
        }
        
        // Verifica se o usuário está ignorado
        if (group && group.ignoredNumbers && Array.isArray(group.ignoredNumbers)) {
          // Check if any part of the author's number matches an ignored number
          const isIgnored = group.ignoredNumbers.some(number => 
            message.author.includes(number) && number.length >= 8
          );
          
          if (isIgnored) {
            this.logger.debug(`Ignorando mensagem de ${message.author} (ignorado no grupo)`);
            return; // Skip processing this message
          }
        }

        // Verifica se é pra ignorar a mensagem por conteúdo
        if (group && group.mutedStrings && Array.isArray(group.mutedStrings) && textContent) {
          const isIgnored = group.mutedStrings.some(str => 
            textContent.toLowerCase().startsWith(str.toLowerCase())
          );
          
          if (isIgnored) {
            this.logger.debug(`Ignorando processamento de mensagem por causa do conteudo: ${textContent.substring(0, 20)}...`);
            return; // Skip processing this message
          }
        }

        // Aplica filtros
        if (await this.applyFilters(bot, message, group)) {
          return; // Mensagem foi filtrada
        }
      } else {
        // Armazena mensagem para histórico de conversação no pv
        SummaryCommands.storeMessage(message, message.group);
      }
        
      
      // Se não houver conteúdo de texto, não pode ser um comando ou menção
      if (!textContent) {
        return this.processNonCommandMessage(bot, message, group);
      }
      
      // Verifica menções ao bot
      const isMentionHandled = await bot.mentionHandler.processMention(bot, message, group, textContent);
      if (isMentionHandled) return;
      
      // Obtém prefixo do grupo ou prefixo padrão do bot
      const prefix = (group && group.prefix !== undefined) ? group.prefix : bot.prefix;
      
      // CORREÇÃO: Verificação adequada para prefixo vazio
      const isCommand = prefix === '' || textContent.startsWith(prefix);
      

      if (isCommand) {
        // Se o prefixo for vazio, usa o texto completo como comando
        // Se não, remove o prefixo do início
        const commandText = prefix === '' ? textContent : textContent.substring(prefix.length);
        
        // IMPORTANTE: Verificação especial para comandos de gerenciamento mesmo com prefixo vazio
        if (commandText.startsWith('g-')) {
          this.logger.debug(`Comando de gerenciamento detectado: ${commandText}`);
          
          // Processa comando sem aguardar para evitar bloqueio
          this.commandHandler.handleCommand(bot, message, commandText, group).catch(error => {
            this.logger.error('Erro em handleCommand:', error);
          });
          
          return; // Evita processamento adicional
        }

        // Processa comando normal
        if(!ignorePV || message.group || this.comandosWhitelist.some(cW => textContent.includes(cW))){
          this.commandHandler.handleCommand(bot, message, commandText, group).catch(error => {
            this.logger.error('Erro em handleCommand:', error);
          });
        }
      } else {
        // Processa mensagem não-comando
        // Aqui também vai cair quando o grupo tiver a opção customIgnoresPrefix, que os comandos personalizados não precisam de prefixo
        this.processNonCommandMessage(bot, message, group).catch(error => {
          this.logger.error('Erro em processNonCommandMessage:', error);
        });
      }
    } catch (error) {
      this.logger.error('Erro ao processar mensagem:', error);
    }
  }

  /**
   * Processa mensagens que não são comandos
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {Group} group - O objeto do grupo (se em grupo)
   */
  async processNonCommandMessage(bot, message, group) {
    // Verifica se é uma mensagem de voz para processamento automático de STT    
    const processed = await SpeechCommands.processAutoSTT(bot, message, group, {returnResult: true});
    if (processed){
      message.content = `Audio[${processed}]`;
      message.caption = `Audio[${processed}]`;

      // Armazena também áudios no histórico!
      SummaryCommands.storeMessage(message, message.author);

      if(false && bot.pvAI && processed.length > 0){ // Desabilitado por enquanto
        this.logger.debug(`[processNonCommandMessage] Recebido áudio no PV e trasncrito, chamando LLM com '${processed}'`);
        // Usa texto extraído do áudio como entrada pro LLM
        const msgsLLM = await aiCommand(bot, message, [], group);
        bot.sendReturnMessages(msgsLLM);
      }
      return;
    } 

    let ignorePV = bot.ignorePV && bot.notInWhitelist(message.author) && message.group === null; 

    if (!group && !ignorePV) {
      const stickerProcessed = await Stickers.processAutoSticker(bot, message, group);
      if (stickerProcessed) return;
    }

    // Trigger para jogos
    if (group && message.type === 'location') {
      const respGeo = await GeoGuesser.processLocationMessage(bot, message);
      if(respGeo){
        bot.sendReturnMessages(respGeo);
      }
    }

    if (message.type === 'text') {
      if(group){
        // Vê se a mensagem não é um MuNews ou horóscopo
        try {
          const isNewsDetected = await MuNewsCommands.detectNews(message.content, group.id);
          if (isNewsDetected) {
            // Opcionalmente, envia uma confirmação de que a MuNews foi detectada e salva
            bot.sendMessage(process.env.GRUPO_LOGS, "📰 *MuNews detectada e salva!*").catch(error => {
              this.logger.error('Erro ao enviar confirmação de MuNews:', error);
            });
            return;
          }

          const isHoroscopoDetected = await HoroscopoCommands.detectHoroscopo(message.content, group.id);
          if (isHoroscopoDetected) {
            // Opcionalmente, envia uma confirmação de que um Horoscopo foi detectado e salvo
            // bot.sendMessage(process.env.GRUPO_LOGS, "🔮 *Horoscopo detectado e salvo!*").catch(error => {
            //   this.logger.error('Erro ao enviar confirmação de Horoscopo:', error);
            // });
            return;
          }

        } catch (error) {
          this.logger.error('Erro ao verificar MuNews ou horóscopo:', error);
        }
      } else {
        // Msg no PV, responder usando IA
        if(bot.pvAI){
          this.logger.debug(`[processNonCommandMessage] PV sem comando, chamando LLM com '${message.content}'`);
          const msgsLLM = await aiCommand(bot, message, [], group);
          bot.sendReturnMessages(msgsLLM);
        }
      }
    }
        
    if (group) {
      try {
        // Se o grupo escolheu a opção 'customIgnoresPrefix', pode ser que um comando personalizado esteja sendo executado
        // Gera um comando e manda pro handleCommand, mas com a flag de ser apenas custom
        const textContent = message.type === 'text' ? message.content : message.caption;

        if(group.customIgnoresPrefix){
          this.commandHandler.processCustomIgnoresPrefix(textContent, bot, message, group);
        }

        if (textContent) {
          // Manipula comandos personalizados acionados automaticamente (aqueles que não requerem prefixo)
          this.commandHandler.checkAutoTriggeredCommands(bot, message, textContent, group);
        }
      } catch (error) {
        this.logger.error('Erro ao verificar comandos acionados automaticamente:', error);
      }
    }
  }

  /**
   * Aplica filtros de mensagem
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {Group} group - O objeto do grupo
   * @returns {Promise<boolean>} - True se a mensagem foi filtrada (deve ser ignorada)
   */
  async applyFilters(bot, message, group) {
    if (!group || !group.filters) return false;
    
    const textContent = message.type === 'text' ? message.content : message.caption ?? "";
    
    if(textContent.includes("g-filtro")){
      return false; // Não filtrar comandos de filtro
    }

    const filters = group.filters;
    
    // Verifica filtro de palavras
    if (filters.words && Array.isArray(filters.words) && filters.words.length > 0) {
      if (textContent) {
        const lowerText = textContent.toLowerCase();
        for (const word of filters.words) {
          if (lowerText.includes(word.toLowerCase())) {
            this.logger.info(`Mensagem filtrada no grupo ${group.id} - contém palavra proibida: ${word}`);
            
            // Deleta a mensagem se possível - não bloqueia
            message.origin.delete(true).catch(error => {
              this.logger.error('Erro ao deletar mensagem filtrada:', error);
            });
            
            return true;
          }
        }
      }
    }
    
    // Verifica filtro de links
    if (filters.links && textContent && textContent.match(/https?:\/\/[^\s]+/g)) {
      this.logger.info(`Mensagem filtrada no grupo ${group.id} - contém link`);
      
      // Deleta a mensagem se possível - não bloqueia
      message.origin.delete(true).catch(error => {
        this.logger.error('Erro ao deletar mensagem filtrada:', error);
      });
      
      return true;
    }
    
    // Verifica filtro de pessoas
    if (filters.people && Array.isArray(filters.people) && filters.people.some(person => message.author.includes(person))) {
      this.logger.info(`Mensagem filtrada no grupo ${group.id} - de usuário banido: ${message.author}`);
      
      // Deleta a mensagem se possível - não bloqueia
      message.origin.delete(true).catch(error => {
        this.logger.error('Erro ao deletar mensagem filtrada:', error);
      });
      
      return true;
    }
    
    // Verifica filtro NSFW para imagens e vídeos
    if (filters.nsfw && (message.type === 'image' || message.type === 'sticker')) { //  || message.type === 'video' removido video por enquanto
      this.logger.info(`Filtros: ${message.type}`);
      // Processa a imagem/vídeo para detecção NSFW
      try {
        // Primeiro salvamos a mídia temporariamente
        const tempDir = path.join(__dirname, '../temp');
        
        // Garante que o diretório temporário exista
        try {
          await fs.access(tempDir);
        } catch (error) {
          await fs.mkdir(tempDir, { recursive: true });
        }
        
        // Gera nome de arquivo temporário único
        const fileExt = (message.type === 'image' || message.type === 'sticker') ? 'jpg' : 'mp4';
        const tempFilePath = path.join(tempDir, `nsfw-check-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`);
        
        // Salva a mídia
        const mediaBuffer = Buffer.from(message.content.data, 'base64');
        await fs.writeFile(tempFilePath, mediaBuffer);
        
        // Apenas imagens são verificadas para NSFW
        if (message.type === 'image' || message.type === 'sticker') {
          // Verifica NSFW
          const result = await this.nsfwPredict.detectNSFW(message.content.data);
          
          // Limpa o arquivo temporário
          fs.unlink(tempFilePath).catch(error => {
            this.logger.error(`Erro ao excluir arquivo temporário ${tempFilePath}:`, error);
          });
          
          if (result.isNSFW) {
            this.logger.info(`Mensagem filtrada no grupo ${group.id} - conteúdo NSFW detectado, motivo: ${result.reason}`);
            
            // Deleta a mensagem
            message.origin.delete(true).catch(error => {
              this.logger.error('Erro ao deletar mensagem NSFW:', error);
            });
            
            return true;
          }
        } else {
          // Para vídeos, apenas limpamos o arquivo temporário
          fs.unlink(tempFilePath).catch(error => {
            this.logger.error(`Erro ao excluir arquivo temporário ${tempFilePath}:`, error);
          });
        }
      } catch (nsfwError) {
        this.logger.error('Erro ao verificar conteúdo NSFW:', nsfwError);
      }
    }
    
    return false;
  }

  /**
   * Manipula evento de entrada no grupo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} data - Dados do evento
   *
   */
  onGroupJoin(bot, data) {
    // Processa entrada sem aguardar para evitar bloquear a thread de eventos
    this.processGroupJoin(bot, data).catch(error => {
      this.logger.error('Erro em processGroupJoin:', error);
    });
  }

    /**
   * Manipula evento de saída no grupo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} data - Dados do evento
   *
   */
  onGroupLeave(bot, data) {
    // Processa entrada sem aguardar para evitar bloquear a thread de eventos
    this.processGroupLeave(bot, data).catch(error => {
      this.logger.error('Erro em processGroupLeave:', error);
    });
  }

  
  
  /**
   * Processa entrada no grupo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} data - Dados do evento
   */
  async processGroupJoin(bot, data) {
    //this.logger.info(`[processGroupJoin] `, {data});
    
    //this.logger.info(`Usuário ${data.user.name} (${data.user.id}) entrou no grupo ${data.group.name} (${data.group.id}). Quem adicionou: ${data.responsavel.name}/${data.responsavel.id}`);
    
    try {
      // Obtém os dados completos do chat
      const chat = await data.origin.getChat();
      
      // Verifica se o próprio bot é quem está entrando
      const isBotJoining = data?.user?.id?.startsWith(bot.phoneNumber);
      this.logger.debug(`[processGroupJoin] isBotJoining (${isBotJoining}}) = data.user.id (${data.user.id}) -startsWith- bot.phoneNumber ${bot.phoneNumber}`);
      
      // Obtém ou cria grupo
      const nomeGrupo = data.group?.name?.replace(/[^a-zA-Z0-9 ]/g, '').replace(/(?:^\w|[A-Z]|\b\w)/g, (w, i) => i === 0 ? w.toLowerCase() : w.toUpperCase()).replace(/\s+/g, '') ?? null;
      const group = await this.getOrCreateGroup(data.group.id, nomeGrupo, bot.prefix);
      this.logger.debug(`Informações do grupo: ${JSON.stringify(group)}`);
      
      // Envia notificação para o grupo de logs
      if (bot.grupoLogs) {
        try {
          if(isBotJoining){
            const msgJoin = `🚪 Bot ${bot.id} entrou no grupo: ${data.group.name} (${nomeGrupo}/${data.group.id})\nQuem add: ${data.responsavel.name}/${data.responsavel.id}`;
            this.logger.info(`[processGroupJoin] ${msgJoin}`);
            bot.sendMessage(bot.grupoLogs, msgJoin);
          }
        } catch (error) {
          this.logger.error('Erro ao enviar notificação de entrada no grupo para o grupo de logs:', error);
        }
      }
      
      if (isBotJoining) {
        // Caso 1: Bot entrou no grupo
        this.logger.info(`Bot entrou no grupo ${data.group.name} (${nomeGrupo}/${data.group.id})`);
        group.paused = false; // Sempre que o bot entra no grupo, tira o pause (para grupos em que saiu/foi removido)
        await this.database.saveGroup(group);
        
        // Busca pendingJoins para ver se esse grupo corresponde a um convite pendente
        const pendingJoins = await this.database.getPendingJoins();
        let foundInviter = null;
        
        // Obtém todos os membros do grupo para verificação
        const members = chat.participants.map(p => p.id._serialized);
        const stringifiedData = JSON.stringify(data);
        
        for (const pendingJoin of pendingJoins) {
          // Verifica se o autor do convite está no grupo (duas abordagens)
          if (members.includes(pendingJoin.authorId) || stringifiedData.includes(pendingJoin.authorId)) {
            foundInviter = pendingJoin;
            break;
          }
        }

        // Envia uma mensagem de boas-vindas padrão sobre o bot
        let botInfoMessage = `🦇 Olá, grupo! Eu sou a *ravenabot*, um bot de WhatsApp. Use "${group.prefix}cmd" para ver os comandos disponíveis.`;
      
        try {
          const groupJoinPath = path.join(this.database.databasePath, 'textos', 'groupJoin.txt');
          
          // Verifica se o arquivo existe
          const fileExists = await fs.access(groupJoinPath).then(() => true).catch(() => false);
          
          if (fileExists) {
            const fileContent = await fs.readFile(groupJoinPath, 'utf8');
            if (fileContent && fileContent.trim() !== '') {
              botInfoMessage = fileContent.trim();
              // Substitui variável {prefix} se presente
              botInfoMessage = botInfoMessage.replace(/{prefix}/g, group.prefix || '!');
            }
          }
        } catch (readError) {
          this.logger.error('Erro ao ler groupJoin.txt, usando mensagem padrão:', readError);
        }
        
        let llm_inviterInfo = "";

        // Adiciona informações do convidador se disponíveis
        if (foundInviter && foundInviter.authorName) {
          botInfoMessage += `\n_(Adicionado por: ${foundInviter.authorName})_`;
          llm_inviterInfo = ` '${foundInviter.authorName}'`;
        }

        botInfoMessage += `\n\nO nome do seu grupo foi definido como *${group.name}*, mas pode você pode alterar usando:- \`${group.prefix}g-setNome [novoNome]\`.\n\nPara fazer a configuração do grupo sem poluir aqui, me envie no PV:\n- ${group.prefix}g-manage ${group.name}`;

        // Se encontramos o autor do convite, adiciona-o como admin adicional
        if (foundInviter) {

          group.addedBy = foundInviter.authorId;
          // Inicializa additionalAdmins se não existir
          if (!group.additionalAdmins) {
            group.additionalAdmins = [];
          }
          
          // Adiciona o autor como admin adicional se ainda não estiver na lista
          if (!group.additionalAdmins.includes(foundInviter.authorId)) {
            group.additionalAdmins.push(foundInviter.authorId);
            await this.database.saveGroup(group);   
          }
      
          // Remove o join pendente
          await this.database.removePendingJoin(foundInviter.code);
        }

        if(bot.comunitario){
          if(bot.supportMsg && bot.supportMsg.length > 0){
            botInfoMessage += `\n---☭---☭---☭---☭---☭---☭---☭---☭---\n${bot.supportMsg}`;
          } else {
            botInfoMessage += `\n\n⭕ Este é um número da ☭ *ravena comunitária* ☭, onde a pessoa que fornece o chip pode ter acesso às suas mensagens (assim como qualquer outro bot ilegal do whats). Se você não concorda com isto, fique lire para removê-la do grupo.⭕\n_Saiba mais enviando !comunitaria ou acessando o site oficial! Ou no !grupao_`;
          }
        }
        
        this.logger.debug(`[groupJoin] botInfoMessage: ${botInfoMessage}`);
        bot.sendMessage(group.id, botInfoMessage).catch(error => {
          this.logger.error('Erro ao enviar mensagem de boas-vindas do grupo:', error);
        });
        
        // Gera e envia uma mensagem com informações sobre o grupo usando LLM
        try {
          // Extrai informações do grupo para o LLM
          const groupInfo = {
            name: chat.name,
            description: chat.groupMetadata?.desc || "",
            memberCount: chat.participants?.length || 0
          };
          
          const llmPrompt = `Você é um bot de WhatsApp chamado ravenabot e foi adicionado em um grupo de whatsapp chamado '${groupInfo.name}'${llm_inviterInfo}, este grupo é sobre '${groupInfo.description}' e tem '${groupInfo.memberCount}' participantes. Gere uma mensagem agradecendo a confiança e fazendo de conta que entende do assunto do grupo enviando algo relacionado junto pra se enturmar, seja natural. Não coloque coisas placeholder, pois a mensagem que você retornar, vai ser enviada na íntegra e sem ediçoes.`;
          
          // Obtém conclusão do LLM sem bloquear
          this.llmService.getCompletion({ prompt: llmPrompt }).then(groupWelcomeMessage => {
            // Envia a mensagem de boas-vindas gerada
            if (groupWelcomeMessage) {
              this.logger.debug(`[groupJoin] LLM Welcome: ${groupWelcomeMessage}`);
              bot.sendMessage(group.id, groupWelcomeMessage).catch(error => {
                this.logger.error('Erro ao enviar mensagem de boas-vindas do grupo:', error);
              });
            }
          }).catch(error => {
            this.logger.error('Erro ao gerar mensagem de boas-vindas do grupo:', error);
          });
        } catch (llmError) {
          this.logger.error('Erro ao gerar mensagem de boas-vindas do grupo:', llmError);
        }
      } else {
        // Caso 2: Outra pessoa entrou no grupo
        // Gera e envia mensagem de boas-vindas para o novo membro
        if (group.greetings) {
          this.generateGreetingMessage(bot, group, data.user, chat).then(welcome => {
            if (welcome) {
              bot.sendMessage(group.id, welcome.message, { mentions: welcome.mentions }).catch(error => {
                this.logger.error('Erro ao enviar mensagem de boas-vindas:', error);
              });
            }
          }).catch(error => {
            this.logger.error('Erro ao gerar mensagem de saudação:', error);
          });
        }
      }
    } catch (error) {
      this.logger.error('Erro ao processar entrada no grupo:', error);
    }
  }

  /**
   * Processa saída do grupo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} data - Dados do evento
   */
  async processGroupLeave(bot, data) {
    this.logger.info(`Usuário ${data.user.name} (${data.user.id}) saiu do grupo ${data.group.name} (${data.group.id}). Quem removeu: ${data.responsavel.name}/${data.responsavel.id}`);
    
    try {
      // Obtém grupo
      const group = this.groups[data.group.id];
      

      // Por enquanto, a única maneira é pegar a info do grupo pra descobrir o LID do bot nele
      const chatInfo = await bot.getChatDetails(data.group.id);
    
      // 1° passo: descobrir o lid do bot nesse grupo (obrigado evo 2.3.5)
      const botNumber = bot.getLidFromPn(bot.phoneNumber, chatInfo);

      const isBotLeaving = data?.user?.id?.startsWith(botNumber);

      this.logger.debug(`[processGroupLeave] isBotLeaving (${isBotLeaving}}) = data.user.id (${data.user.id}) -startsWith- bot.phoneNumber ${botNumber}`, {data, chatInfo});
      
      // Envia notificação para o grupo de logs
      if (bot.grupoLogs) {
        try {
          if(isBotLeaving){
            //group.paused = true; // Sempre que o bot sai do grupo, pausa o mesmo
            await this.database.saveGroup(group);
            bot.sendMessage(bot.grupoLogs, `🚪 Bot ${bot.id} saiu do grupo: ${data.group.name} (${data.group.id})})\nQuem removeu: ${data.responsavel.name}/${data.responsavel.id}`).catch(error => {
              this.logger.error('Erro ao enviar notificação de entrada no grupo para o grupo de logs:', error);
            });

          }
        } catch (error) {
          this.logger.error('Erro ao enviar notificação de saída do grupo para o grupo de logs:', error);
        }
      }
      
      if (group && group.farewells && !isBotLeaving) {
        const farewell = await this.processFarewellMessage(group, data.user, bot);
        if (farewell) {
          bot.sendMessage(data.group.id, farewell.message, { mentions: farewell.mentions }).catch(error => {
            this.logger.error('Erro ao enviar mensagem de despedida:', error);
          });
        }
      }
    } catch (error) {
      this.logger.error('Erro ao processar saída do grupo:', error);
    }
  }
  /**
   * Gera mensagem de saudação para novos membros do grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Group} group - O objeto do grupo
   * @param {Object} user - O usuário que entrou
   * @param {Object} chatData - Dados adicionais do chat (opcional)
   * @returns {Promise<string|MessageMedia>} - A mensagem de saudação
   */
  async generateGreetingMessage(bot, group, user, chatData = null) {
    try {
      if (!group.greetings) return null;
      
      // MENTIONS QUEBRADOS POR CAUSA DE LID
      //this.logger.info(`[generateGreetingMessage] `, {group, user, chatData});

      // Obtém os dados completos do chat, se não fornecidos
      if (!chatData) {
        try {
          // Tenta obter o chat para mais informações
          chatData = await bot.client.getChatById(group.id);
        } catch (error) {
          this.logger.error('Erro ao obter dados do chat para saudação:', error);
        }
      }
      
      // Se houver múltiplos usuários, prepara os nomes
      let nomesPessoas = "";
      let numeroPessoas = "";
      let quantidadePessoas = 1;
      let isPlural = false;
      let mentions = [];

       if (Array.isArray(user)) {
        numeroPessoas = user.map(u => `@${u.id.split('@')[0]}` || "@123456780").join(", ");
        quantidadePessoas = user.length;
        isPlural = quantidadePessoas > 1;
        mentions = user.map(u => u.id);
      } else {
        numeroPessoas = `@${user.id.split('@')[0]}` || "@123456780";
        mentions = [user.id];
      }

      // Se saudação de texto
      if (group.greetings.text) {
        // Substitui variáveis
        let message = group.greetings.text;
        
        // Variáveis básicas
        //message = message.replace(/{pessoa}/g, nomesPessoas);
        message = message.replace(/{pessoa}/g, numeroPessoas); // Usa o numero pra marcar
        
        // Variáveis de grupo
        message = message.replace(/{tituloGrupo}/g, chatData?.name || "Grupo");
        message = message.replace(/{nomeGrupo}/g, group?.name || "Grupo");
        message = message.replace(/{nomePessoas}/g, numeroPessoas);
        message = message.replace(/{numeroPessoas}/g, numeroPessoas);
        
        // Variáveis de pluralidade
        if (isPlural) {
          message = message.replace(/{plural_S}/g, "s");
          message = message.replace(/{plural_M}/g, "m");
          message = message.replace(/{plural_s}/g, "s");
          message = message.replace(/{plural_m}/g, "m");
          message = message.replace(/{plural_esao}/g, "são");
        } else {
          message = message.replace(/{plural_S}/g, "");
          message = message.replace(/{plural_M}/g, "");
          message = message.replace(/{plural_s}/g, "");
          message = message.replace(/{plural_m}/g, "");
          message = message.replace(/{plural_esao}/g, "é");
        }
        
        // Processa variáveis
        const options = {};
        message = await this.variableProcessor.process(message, {message: false, group, options, bot});
        
        if(options.mentions && options.mentions.length > 0){
          mentions = mentions.concat(options.mentions);
        }

        mentions = [...new Set(mentions)]; // deixa unicos
        return { message, mentions };
      }
      
      // Se saudação de sticker
      if (group.greetings.sticker) {
        // TODO: Implementar saudação de sticker
      }
      
      // Se saudação de imagem
      if (group.greetings.image) {
        // TODO: Implementar saudação de imagem
      }
      
      // Saudação padrão
      //return `Bem-vindo ao grupo, ${user.name}!`;
      return false;
    } catch (error) {
      this.logger.error('Erro ao gerar mensagem de saudação:', error);
      return null;
    }
  }

  /**
   * Processa mensagem de despedida para membros que saem do grupo
   * @param {Group} group - O objeto do grupo
   * @param {Object} user - O usuário que saiu
   * @returns {string} - A mensagem de despedida
   */
  async processFarewellMessage(group, user, bot, chatData) {
    try {
      if (!group.farewells) return null;
      
      // Se despedida de texto
      if (group.farewells.text) {

        // Obtém os dados completos do chat, se não fornecidos
        if (!chatData) {
          try {
            // Tenta obter o chat para mais informações
            chatData = await bot.client.getChatById(group.id);
          } catch (error) {
            this.logger.error('Erro ao obter dados do chat para despedidas:', error);
          }
        }

        // Substitui variáveis
        let message = group.farewells.text;
        message = message.replace(/{pessoa}/g, `@${user.id.split('@')[0]}`);
        message = message.replace(/{tituloGrupo}/g, chatData?.name || "Grupo");
        
        // Processa variáveis
        const options = {};
        message = await this.variableProcessor.process(message, {message: false, group, options, bot});
        
        let mentions = [user.id];
        if(options.mentions && options.mentions.length > 0){
          mentions = mentions.concat(options.mentions);
        }

        mentions = [...new Set(mentions)]; // deixa unicos

        return { message, mentions };
      }
      
      // Despedida padrão
      //return `Adeus, ${user.name}!`;
      return false;
    } catch (error) {
      this.logger.error('Erro ao processar mensagem de despedida:', error);
      return null;
    }
  }
  
  /**
   * Manipula notificações gerais
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} notification - A notificação
   */
  onNotification(bot, notification) {
    // Implementação opcional para tratar outros tipos de notificações
  }

    /**
   * Exemplo de método que verifica permissões administrativas
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} action - A ação a ser realizada
   * @param {Group} group - O objeto do grupo
   * @returns {Promise<boolean>} - True se a ação for permitida
   */
  async checkPermission(bot, message, action, group) {
    try {
      // Obtém o chat diretamente da mensagem original
      const chat = await message.origin.getChat();
      
      // Usa o AdminUtils para verificar permissões
      const isAdmin = await this.adminUtils.isAdmin(message.author, group, chat, bot.client);
      
      if (!isAdmin) {
        this.logger.warn(`Usuário ${message.author} tentou realizar a ação "${action}" sem permissão`);
        
        // Notifica o usuário (opcional)
        const returnMessage = new ReturnMessage({
          chatId: message.group || message.author,
          content: `⛔ Você não tem permissão para realizar esta ação: ${action}`
        });
        await bot.sendReturnMessages(returnMessage);
        
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Erro ao verificar permissões para ação "${action}":`, error);
      return false;
    }
  }

}

module.exports = EventHandler;
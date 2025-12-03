/**
 * Modelo Command representando um comando do bot com suas propriedades e comportamentos
 */
class Command {
  /**
   * Cria uma nova instância de Command
   * @param {Object} data - Dados do comando
   */
  constructor(data = {}) {
    // Propriedades identificadoras
    this.name = data.name || '';                    // Nome do comando (obrigatório)
    this.aliases = data.aliases || [];              // Nomes alternativos para o comando
    this.description = data.description || '';      // Descrição do comando
    this.usage = data.usage || '';                  // Exemplo de uso do comando
    this.category = data.category || 'general';     // Categoria do comando
    this.group = data.group || false;               // Agrupar comandos parecido
    
    // Requisitos
    this.needsMedia = data.needsMedia || false;     // Se o comando requer mídia
    this.needsQuotedMsg = data.needsQuotedMsg || false; // Se o comando requer mensagem citada
    this.needsArgs = data.needsArgs || false;       // Se o comando requer argumentos
    this.minArgs = data.minArgs || 0;               // Número mínimo de argumentos
    this.adminOnly = data.adminOnly || false;       // Se apenas administradores podem usar
    this.caseSensitive = data.caseSensitive || true;
    
    this.exclusive = undefined;                     // Comandos exclusivos por grupo (como API pagas)

    this.ignoreInteract = false;                    // Não usar este comando no interagir automatico

    // Reações e feedback
    this.reactions = data.reactions || {
      trigger: false,                                // Emoji usado para ativar um comando
      before: process.env.LOADING_EMOJI ?? "🌀",                                 // Emoji usado antes da execução
      after: "✅",                                  // Emoji usado após execução bem-sucedida
      error: "❌"                                   // Emoji usado em caso de erro
    };
    
    // Controle de tempo e limitação
    this.cooldown = data.cooldown || 0;             // Tempo mínimo entre usos (segundos)
    this.timeout = data.timeout || 30;              // Tempo máximo de execução (segundos)
    
    // Comportamento de resposta
    this.deleteOnComplete = data.deleteOnComplete || false;    // Se deve excluir a mensagem original após concluir
    
    // Processamento e execução
    this.method = data.method || null;              // Função que implementa o comando (obrigatória)
    this.middlewares = data.middlewares || [];      // Middlewares para pré-processamento
    
    // Metadados e estatísticas
    this.createdAt = data.createdAt || Date.now();  // Data de criação do comando
    this.updatedAt = data.updatedAt || Date.now();  // Data da última atualização
    this.count = data.count || 0;                   // Contador de uso
    this.lastUsed = data.lastUsed || null;          // Timestamp do último uso
    this.metadata = data.metadata || {};            // Metadados adicionais
    
    // Estado e visibilidade
    this.active = data.active !== undefined ? data.active : true; // Se o comando está ativo
    this.hidden = data.hidden || false;             // Se o comando deve ser oculto em listagens
    
    // Flag para indicar se o comando usa ReturnMessage
    this.usesReturnMessage = data.usesReturnMessage !== undefined ? data.usesReturnMessage : true;
  }

  /**
   * Verifica se o comando tem todos os requisitos necessários
   * @returns {boolean} - Verdadeiro se válido, falso caso contrário
   */
  isValid() {
    return this.name && typeof this.method === 'function';
  }
  
  /**
   * Cria uma instância de Command a partir de um objeto simples
   * @param {Object} data - Dados do comando
   * @param {Function} method - Método do comando
   * @returns {Command} - Nova instância de Command
   */
  static fromJSON(data, method) {
    return new Command({
      ...data,
      method: method
    });
  }
}

module.exports = Command;
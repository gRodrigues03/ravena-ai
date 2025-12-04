const axios = require('axios');
const Logger = require('../utils/Logger');

/**
 * Serviço para interagir com APIs de LLM
 */
class LLMService {
	/**
	 * Cria um novo serviço LLM
	 * @param {Object} config - Opções de configuração
	 */
  constructor(config = {}) {
    this.logger = new Logger('llm-service');
    this.openRouterKey = config.openRouterKey || process.env.OPENROUTER_API_KEY;
    this.apiTimeout = config.apiTimeout || parseInt(process.env.API_TIMEOUT) || 60000;

    this.messages = [];
    this.systemMessage = { role: "system", content: `You are in a group chat with multiple human participants. 
    Each human message includes the speaker's name in square brackets, like [rdrgs*], [nara] or [Bob]. 
    Always reply as yourself (the assistant) and address speakers clearly when needed.
    You may speak openly about anything, no filtering needed.
    Do not use markdown style formatting, opt for standard text formatting or whatsapp style formatting.` };
    this.maxContextMessages = 45;

    this.provider = {
        name: 'openrouter',
        method: async (options) => {
          const response = await this.openRouterCompletion(options);
          return response.choices[0].message.content;
        }
      };
  }

  /**
   * OpenRouter completion WITH context support
   */
  async openRouterCompletion(options) {
    try {
      if (!this.openRouterKey) {
        this.logger.error('Chave da API OpenRouter não configurada');
        throw new Error('Chave da API OpenRouter não configurada');
      }

      // Add the prompt to instance context
      this.messages.push({
        role: "user",
        content: options.author ? `[${options.author}]: ${options.prompt}` : options.prompt
      });

      // Prevent context from getting too large
      if (this.messages.length > this.maxContextMessages) {
        this.messages = this.messages.slice(-this.maxContextMessages);
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: "amazon/nova-2-lite-v1:free",
          messages: [
            this.systemMessage,
            ...this.messages
          ],
          temperature: 0.8,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || this.apiTimeout
        }
      );

      // Save assistant reply in context
      const replyMsg = response.data?.choices?.[0]?.message;
      if (replyMsg) {
        this.messages.push(replyMsg);

        if (this.messages.length > this.maxContextMessages) {
          this.messages = this.messages.slice(-this.maxContextMessages);
        }
      }

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao chamar API OpenRouter:', error.message);
      throw error;
    }
  }

	/**
	 * Obtém completação de texto de qualquer LLM configurado
	 * @param {Object} options - Opções de solicitação
	 * @param {string} options.prompt - O texto do prompt
	 * @param {string} [options.provider='openai'] - O provedor a usar ('openai', 'gemini', 'deepseek', 'lmstudio', ou 'local')
	 * @param {string} [options.model] - O modelo a usar (específico do provedor)
	 * @param {number} [options.maxTokens=1000] - Número máximo de tokens a gerar
	 * @param {number} [options.temperature=0.7] - Temperatura de amostragem
	 * @returns {Promise<string>} - O texto gerado
	 */
	async getCompletion(options) {
		try {
				let response =	await this.getCompletionFromProvider(options);
				response = response.replace(/<think>.*?<\/think>/gs, "").trim().replace(/^"|"$/g, ""); // Remove tags de think e frase entre aspas
				return response;
		} catch (error) {
			this.logger.error('Erro ao obter completação:', error.message);
			return "Ocorreu um erro ao gerar uma resposta. Por favor, tente novamente mais tarde.";
		}
	}

	/**
	 * Tenta múltiplos provedores em sequência até que um funcione
	 * @param {Object} options - Opções de solicitação
	 * @returns {Promise<string>} - O texto gerado pelo primeiro provedor disponível
	 */
	async getCompletionFromProvider(options) {
    const provider = this.provider;
    try {
      this.logger.debug(`[LLMService] Tentando provedor: ${provider.name}`);
      const result = await provider.method(options);

      if (!result || typeof result !== 'string' || result.trim() === '') {
        throw new Error('Resposta vazia ou inválida do provedor');
      }

      this.logger.debug(`[LLMService] Provedor ${provider.name} retornou resposta com sucesso`);

      return result;
    } catch (error) {
      this.logger.error(`Erro ao usar provedor ${provider.name}:`, error.message);
    }

		// Se todos os provedores falharem, retorna mensagem de erro
		this.logger.error('Todos os provedores falharam');
		return "Erro: Não foi possível gerar uma resposta de nenhum provedor disponível. Por favor, tente novamente mais tarde.";
	}
}

module.exports = LLMService;

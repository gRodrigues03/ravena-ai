const axios = require('axios');
const Logger = require('../utils/Logger');
const fs = require('fs');
const path = require('path');

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

		this.providerDefinitions = [
      {
        name: 'openrouter',
        method: async (options) => {
          const response = await this.openRouterCompletion(options);
          return response.choices[0].message.content;
        }
      }
		];

		this.providerQueue = [...this.providerDefinitions];
		this.lastQueueChangeTimestamp = 0;
		this.resetQueueTimeout = 30 * 60 * 1000; // 30 minutos
	}

	/**
	 * Envia uma solicitação de completação para OpenRouter
	 * @param {Object} options - Opções de solicitação
	 * @param {string} options.prompt - O texto do prompt
	 * @param {string} [options.model='google/gemini-2.5-flash:free'] - O modelo a usar
	 * @param {number} [options.maxTokens=1000] - Número máximo de tokens a gerar
	 * @param {number} [options.temperature=0.7] - Temperatura de amostragem
	 * @returns {Promise<Object>} - A resposta da API
	 */
	async openRouterCompletion(options) {
		try {
			if (!this.openRouterKey) {
				this.logger.error('Chave da API OpenRouter não configurada');
				throw new Error('Chave da API OpenRouter não configurada');
			}

			this.logger.debug('Enviando solicitação para API OpenRouter:', {
				model: "x-ai/grok-4.1-fast:free",
				promptLength: options.prompt.length,
				maxTokens: options.maxTokens || 5000
			});

			const response = await axios.post(
				'https://openrouter.ai/api/v1/chat/completions',
				{
					model: "x-ai/grok-4.1-fast:free",
					messages: [
						{ role: 'user', content: options.prompt }
					],
					max_tokens: options.maxTokens || 5000,
					temperature: options.temperature || 0.7
				},
				{
					headers: {
						'Authorization': `Bearer ${this.openRouterKey}`,
						'Content-Type': 'application/json'
					},
					timeout: options.timeout || this.apiTimeout
				}
			);

			// this.logger.debug('Resposta recebida da API OpenRouter', {
			//	 status: response.status,
			//	 data: response.data,
			//	 contentLength: JSON.stringify(response.data).length
			// });

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
			// Se um provedor específico for solicitado, use-o diretamente
			if (options.provider) {
				this.logger.debug('[LLMService] Obtendo completação com opções:', { 
					provider: options.provider,
					promptLength: options.prompt.length,
					temperature: options.temperature || 0.7
				});

				let response = await this.getCompletionFromSpecificProvider(options);
				response = response.replace(/<think>.*?<\/think>/gs, "").trim().replace(/^"|"$/g, ""); // Remove tags de think e frase entre aspas

				return response;
			} 
			// Caso contrário, tente múltiplos provedores em sequência
			else {
				//this.logger.debug('[LLMService] Nenhum provedor específico solicitado, tentando múltiplos provedores em sequência');

				let response =	await this.getCompletionFromProviders(options);
				response = response.replace(/<think>.*?<\/think>/gs, "").trim().replace(/^"|"$/g, ""); // Remove tags de think e frase entre aspas

				return response;
			}
		} catch (error) {
			this.logger.error('Erro ao obter completação:', error.message);
			return "Ocorreu um erro ao gerar uma resposta. Por favor, tente novamente mais tarde.";
		}
	}

	/**
	 * Obtém completação de um provedor específico
	 * @param {Object} options - Opções de solicitação
	 * @returns {Promise<string>} - O texto gerado
	 * @private
	 */
	async getCompletionFromSpecificProvider(options) {
		let response;
    response = await this.openRouterCompletion(options);
    if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
      this.logger.error('Resposta inválida da API OpenRouter:', response);
      return "Erro: Não foi possível gerar uma resposta. Por favor, tente novamente mais tarde.";
    }
    return response.choices[0].message.content;
	}

	/**
	 * Tenta múltiplos provedores em sequência até que um funcione
	 * @param {Object} options - Opções de solicitação
	 * @returns {Promise<string>} - O texto gerado pelo primeiro provedor disponível
	 */
	async getCompletionFromProviders(options) {
		const now = Date.now();
		if (this.lastQueueChangeTimestamp > 0 && (now - this.lastQueueChangeTimestamp > this.resetQueueTimeout)) {
			this.logger.info('[LLMService] Resetando a fila de provedores para a ordem padrão após 30 minutos.');
			this.providerQueue = [...this.providerDefinitions];
			this.lastQueueChangeTimestamp = 0;
		}

		for (let i = 0; i < this.providerQueue.length; i++) {
			const provider = this.providerQueue[i];
			try {
				this.logger.debug(`[LLMService] Tentando provedor: ${provider.name}`);
				const result = await provider.method(options);

				if (!result || typeof result !== 'string' || result.trim() === '') {
					throw new Error('Resposta vazia ou inválida do provedor');
				}

				this.logger.debug(`[LLMService] Provedor ${provider.name} retornou resposta com sucesso`);

				// Se o provedor bem-sucedido não for o primeiro, mova-o para o início.
				if (i > 0) {
					this.logger.info(`[LLMService] Promovendo provedor ${provider.name} para o início da fila.`);
					const [successfulProvider] = this.providerQueue.splice(i, 1);
					this.providerQueue.unshift(successfulProvider);
					this.lastQueueChangeTimestamp = Date.now();
				}

				return result;
			} catch (error) {
				this.logger.error(`Erro ao usar provedor ${provider.name}:`, error.message);

				// Move o provedor que falhou para o final da fila.
				this.logger.warn(`[LLMService] Rebaixando provedor ${provider.name} para o final da fila.`);
				const [failedProvider] = this.providerQueue.splice(i, 1);
				this.providerQueue.push(failedProvider);
				this.lastQueueChangeTimestamp = Date.now();

				// Decrementa i para tentar o novo provedor no índice atual.
				i--;
			}
		}

		// Se todos os provedores falharem, retorna mensagem de erro
		this.logger.error('Todos os provedores falharam');
		return "Erro: Não foi possível gerar uma resposta de nenhum provedor disponível. Por favor, tente novamente mais tarde.";
	}
}

module.exports = LLMService;

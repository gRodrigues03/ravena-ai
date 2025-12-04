const util = require('util');

/**
 * Utilitário de Logger para registrar mensagens no console e arquivo
 */
class Logger {
  /**
   * Cria um novo logger
   * @param {string} name - Nome do logger (será incluído no nome do arquivo)
   */
  constructor(name) {
    this.name = name;
    this.debugMode = process.env.DEBUG === 'true';
  }

  /**
   * Escreve uma mensagem de log
   * @param {string} level - Nível de log
   * @param {string} message - Mensagem de log
   * @param {any} [data] - Dados adicionais para registrar
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}`;
    
    // Adiciona dados se fornecidos
    if (data) {
      if (typeof data === 'object') {
        logMessage += '\n' + util.inspect(data, { depth: null, colors: false });
      } else {
        logMessage += ' ' + data;
      }
    }
    
    // Registra no console
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](logMessage);
  }

  /**
   * Registra uma mensagem de informação
   * @param {string} message - Mensagem de log
   * @param {any} [data] - Dados adicionais para registrar
   */
  info(message, data = null) {
    this.log('info', message, data);
  }

  /**
   * Registra uma mensagem de aviso
   * @param {string} message - Mensagem de log
   * @param {any} [data] - Dados adicionais para registrar
   */
  warn(message, data = null) {
    this.log('warn', message, data);
  }

  /**
   * Registra uma mensagem de erro
   * @param {string} message - Mensagem de log
   * @param {any} [data] - Dados adicionais para registrar
   */
  error(message, data = null) {
    this.log('error', message, data);
  }

  /**
   * Registra uma mensagem de depuração
   * @param {string} message - Mensagem de log
   * @param {any} [data] - Dados adicionais para registrar
   */
  debug(message, data = null) {
    if (this.debugMode) {
      this.log('debug', message, data);
    }
  }
}

module.exports = Logger;
const Database = require('./Database');
const Logger = require('./Logger');

/**
 * Classe utilitária para verificação de permissões administrativas
 */
class AdminUtils {
  constructor() {
    this.logger = new Logger('admin-utils');
    this.database = Database.getInstance();
    this.superAdmins = process.env.SUPER_ADMINS ? process.env.SUPER_ADMINS.split(',') : [];
  }

  _normalizeId(id) {
    // Retorna uma string vazia se o ID for inválido para evitar erros.
    if (typeof id !== 'string' || !id) {
      return '';
    }
    // Divide a string no '@' e pega a primeira parte.
    return id.split('@')[0];
  }

  /**
   * Verifica se um usuário é administrador no grupo
   * @param {string} userId - ID do usuário a verificar
   * @param {Object} group - Objeto do grupo do banco de dados
   * @param {Object} chat - Objeto de chat do WhatsApp (opcional)
   * @param {Object} client - Instância do cliente WhatsApp (opcional)
   * @returns {Promise<boolean>} - True se o usuário for admin
   */
  async isAdmin(userId, group, chat = null, client = null) {
    try {
      const normalizedUserId = this._normalizeId(userId);

      // Se o ID normalizado for vazio, o usuário é inválido.
      if (!normalizedUserId) {
        this.logger.debug(`ID de usuário inválido fornecido: ${userId}`);
        return false;
      }

      // 1. Verifica se é um super admin (usando o ID normalizado)
      if (this.isSuperAdmin(normalizedUserId)) {
        this.logger.debug(`Usuário ${normalizedUserId} é super admin.`);
        return true;
      }

      // 2. Verifica 'additionalAdmins' no objeto de grupo
      if (group && Array.isArray(group.additionalAdmins)) {
        const isAdditionalAdmin = group.additionalAdmins
          .map(this._normalizeId) // Normaliza cada ID da lista de admins
          .includes(normalizedUserId);

        if (isAdditionalAdmin) {
          this.logger.debug(`Usuário ${normalizedUserId} é admin adicional no grupo ${group.id}.`);
          return true;
        }
      }

      // 3. Verifica se é admin no WhatsApp
      let chatInstance = chat;

      // Se o chat não foi fornecido, tenta buscá-lo usando o cliente
      if (!chatInstance && client && group && group.id) {
        try {
          chatInstance = await client.getChatById(group.id);
        } catch (chatError) {
          this.logger.error(`Erro ao buscar chat ${group.id} para verificação de admin:`, chatError);
          // A função continua, mas provavelmente retornará false se esta era a única forma de ser admin.
        }
      }

      // Se temos uma instância de chat (fornecida ou buscada) e é um grupo, verificamos os participantes.
      if (chatInstance && chatInstance.isGroup) {
        const participant = chatInstance.participants.find(
          p => this._normalizeId(p.id._serialized) === normalizedUserId
        );

        if (participant && participant.isAdmin) {
          this.logger.debug(`Usuário ${normalizedUserId} é admin no WhatsApp para o grupo ${group.id}.`);
          return true;
        }
      }

      // Se nenhuma das verificações acima passou, o usuário não é admin.
      return false;

    } catch (error) {
      this.logger.error(`Erro ao verificar se o usuário ${userId} é admin:`, error);
      return false; // Retorna false em caso de erro inesperado.
    }
  }


  /**
   * Verifica se um usuário é super admin
   * @param {string} userId - ID do usuário a verificar
   * @returns {boolean} - True se o usuário for super admin
   */
  isSuperAdmin(userId) {
    return this.superAdmins.includes(userId);
  }

  /**
   * Verifica se um usuário é dono do grupo
   * @param {string} userId - ID do usuário a verificar 
   * @param {Object} group - Objeto do grupo do banco de dados
   * @returns {boolean} - True se o usuário for dono do grupo
   */
  isGroupOwner(userId, group) {
    if (!group || !group.addedBy) return false;
    return group.addedBy === userId;
  }
}

// Singleton para reutilização
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new AdminUtils();
    }
    return instance;
  }
};
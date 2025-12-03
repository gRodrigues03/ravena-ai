const axios = require('axios');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

// Create a new logger
const logger = new Logger('riot-games-commands');

// Riot Games API key from environment variables
const RIOT_API_KEY = process.env.RIOT_GAMES;

// Base URLs for different Riot APIs
const RIOT_BASE_URL = 'https://americas.api.riotgames.com/riot';
const LOL_BASE_URL = 'https://br1.api.riotgames.com/lol'; // Default to NA region
const CHAMPIONS_URL = 'https://ddragon.leagueoflegends.com/cdn/15.10.1/data/en_US/champion.json';


// Emoji mapping for ranked tiers
const RANK_EMOJIS = {
  'IRON': '🔗',
  'BRONZE': '🥉',
  'SILVER': '🥈',
  'GOLD': '🥇',
  'PLATINUM': '💎',
  'DIAMOND': '💍',
  'MASTER': '🏆',
  'GRANDMASTER': '👑',
  'CHALLENGER': '⚡'
};

const RANK_EMOJIS_VALORANT = {
    "Iron 1": '🔗',
    "Iron 2": '🔗',
    "Iron 3": '🔗',
    "Iron":'🔗',
    "Bronze 1": '🥉',
    "Bronze 2": '🥉',
    "Bronze 3": '🥉',
    "Bronze":'🥉',
    "Silver 1": '🥈',
    "Silver 2": '🥈',
    "Silver 3": '🥈',
    "Silver":'🥈',
    "Gold 1": '🥇',
    "Gold 2": '🥇',
    "Gold 3": '🥇',
    "Gold":'🥇',
    "Platinum 1": '💎',
    "Platinum 2": '💎',
    "Platinum 3": '💎',
    "Platinum":'💎',
    "Diamond 1": '💍',
    "Diamond 2": '💍',
    "Diamond 3": '💍',
    "Diamond":'💍',
    "Ascendant 1": '😇',
    "Ascendant 2": '😇',
    "Ascendant 3": '😇',
    "Ascendant":'😇',
    "Immortal 1": '☠️',
    "Immortal 2": '☠️',
    "Immortal 3": '☠️',
    "Immortal":'☠️',
    "Radiant": '🌞'
};

/**
 * Get rank emoji for a tier
 * @param {string} tier - Rank tier (e.g., GOLD, PLATINUM)
 * @returns {string} - Corresponding emoji
 */
function getRankEmoji(tier) {
  return RANK_EMOJIS[tier] || '❓';
}

/**
 * Format number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get League of Legends summoner data
 * @param {string} gameName - Summoner name to look up
 * @param {string} tagLine - Summoner tagLine to look up
 * @returns {Promise<Object>} - Formatted summoner data
 */
async function getLolSummonerData(gameName, tagLine) {
  try {
    // Fetch account by gameName/tagLine
    const accountResponse = await axios.get(
      `${RIOT_BASE_URL}/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    /*
    {
      "puuid": "JJyNY...",
      "gameName": "Nome",
      "tagLine": "TAG"
    }
    */
    const account = accountResponse.data;

    const summonerRequest = await axios.get(
      `${LOL_BASE_URL}/summoner/v4/summoners/by-puuid/${account.puuid}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const summoner = summonerRequest.data;

    // Fetch ranked data
    console.log("ranked", `${LOL_BASE_URL}/league/v4/entries/by-puuid/${summoner.puuid}`);
    const rankedResponse = await axios.get(
      `${LOL_BASE_URL}/league/v4/entries/by-puuid/${summoner.puuid}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    console.log(rankedResponse);
    
    // Fetch mastery data (top 5 champions)
    console.log("champion",`${LOL_BASE_URL}/champion-mastery/v4/champion-masteries/by-puuid/${summoner.puuid}/top?count=5`);
    const masteryResponse = await axios.get(
      `${LOL_BASE_URL}/champion-mastery/v4/champion-masteries/by-puuid/${summoner.puuid}/top?count=5`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    console.log(masteryResponse);
    
    // Get champion data to map champion IDs to names
    console.log("champion");
    const championResponse = await axios.get(
      CHAMPIONS_URL,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    
    const championData = championResponse.data.data;
    const championIdToName = {};
    
    // Map champion IDs to names
    for (const champKey in championData) {
      const champion = championData[champKey];
      championIdToName[champion.key] = champion.name;
    }
    
    // Process ranked data
    const soloQueue = rankedResponse.data.find(queue => queue.queueType === 'RANKED_SOLO_5x5') || {};
    const flexQueue = rankedResponse.data.find(queue => queue.queueType === 'RANKED_FLEX_SR') || {};
    
    // Process mastery data
    const masteryData = masteryResponse.data.map(mastery => ({
      championName: championIdToName[mastery.championId] || `Champion #${mastery.championId}`,
      championLevel: mastery.championLevel,
      championPoints: mastery.championPoints
    }));
    
    return {
      name: `${gameName}#${tagLine}`,
      level: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      soloQueue: {
        tier: soloQueue.tier || 'UNRANKED',
        rank: soloQueue.rank || '',
        leaguePoints: soloQueue.leaguePoints || 0,
        wins: soloQueue.wins || 0,
        losses: soloQueue.losses || 0
      },
      flexQueue: {
        tier: flexQueue.tier || 'UNRANKED',
        rank: flexQueue.rank || '',
        leaguePoints: flexQueue.leaguePoints || 0,
        wins: flexQueue.wins || 0,
        losses: flexQueue.losses || 0
      },
      mastery: masteryData
    };
  } catch (error) {
    logger.error(`Error fetching LoL data for ${gameName}#${tagLine}:`, error.message);
    throw new Error(`Não foi possível encontrar o invocador "${gameName}#${tagLine}" ou ocorreu um erro durante a busca.`);
  }
}

/**
 * Format LoL summoner data into a message
 * @param {Object} data - Summoner data
 * @returns {string} - Formatted message
 */
function formatLolMessage(data) {
  // Calculate win rates
  const soloWinRate = data.soloQueue.wins + data.soloQueue.losses > 0 
    ? Math.round((data.soloQueue.wins / (data.soloQueue.wins + data.soloQueue.losses)) * 100) 
    : 0;
    
  const flexWinRate = data.flexQueue.wins + data.flexQueue.losses > 0 
    ? Math.round((data.flexQueue.wins / (data.flexQueue.wins + data.flexQueue.losses)) * 100) 
    : 0;
  
  let message = `🎮 *League of Legends - ${data.name}*\n`;
  message += `📊 Nível: ${data.level}\n\n`;
  
  // Solo/Duo queue
  message += `*💪 Ranqueada Solo/Duo:*\n`;
  if (data.soloQueue.tier === 'UNRANKED') {
    message += `Sem classificação\n`;
  } else {
    message += `${getRankEmoji(data.soloQueue.tier)} ${data.soloQueue.tier} ${data.soloQueue.rank} (${data.soloQueue.leaguePoints} LP)\n`;
    message += `🏅 ${data.soloQueue.wins}V ${data.soloQueue.losses}D (${soloWinRate}% de vitórias)\n`;
  }
  
  // Flex queue
  message += `\n*👥 Ranqueada Flex:*\n`;
  if (data.flexQueue.tier === 'UNRANKED') {
    message += `Sem classificação\n`;
  } else {
    message += `${getRankEmoji(data.flexQueue.tier)} ${data.flexQueue.tier} ${data.flexQueue.rank} (${data.flexQueue.leaguePoints} LP)\n`;
    message += `🏅 ${data.flexQueue.wins}V ${data.flexQueue.losses}D (${flexWinRate}% de vitórias)\n`;
  }
  
  // Champion mastery
  message += `\n*🏆 Principais Campeões:*\n`;
  for (let i = 0; i < data.mastery.length; i++) {
    const champ = data.mastery[i];
    message += `${i+1}. ${champ.championName} (Nível ${champ.championLevel}, ${formatNumber(champ.championPoints)} pts)\n`;
  }
  
  return message;
}

/**
 * Parse a Riot ID from input
 * @param {Array} args - Command arguments
 * @returns {Object} - Parsed game name and tag line
 */
function parseRiotId(args) {
  const input = args.join(' ');

  if (input.includes('#')) {
    const [namePart, tagPart] = input.split('#');

    let tagLine;
    let server = null;

    if (tagPart.includes('-')) {
      [tagLine, server] = tagPart.split('-');
    } else {
      tagLine = tagPart;
    }

    return {
      gameName: namePart.trim(),
      tagLine: tagLine?.trim() || null,
      server: server?.trim().toUpperCase() || null
    };
  }

  // Fallback for no hashtag
  if (args.length >= 2) {
    const lastArg = args.pop();
    return {
      gameName: args.join(' ').trim(),
      tagLine: lastArg.trim(),
      server: null
    };
  }

  return {
    gameName: input.trim(),
    tagLine: null,
    server: null
  };
}


/**
 * Handles the LoL command
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage or array of ReturnMessages
 */
async function handleLolCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um nome de invocador. Exemplo: !lol Faker#ABC'
      });
    }
    
    const summonerName = args.join(' ');

    if(!summonerName.includes("#")){
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Informe o nome do invocador seguido da tag, exemplo: !lol Faker#ABC`
      });
    }


    // Send a waiting message
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `🔍 Buscando invocador: ${summonerName}...`
      })
    );
    
    // Get summoner data
    const [ gameName, tagLine ] = summonerName.split("#");
    const summonerData = await getLolSummonerData(gameName, tagLine);
    
    // Format message
    const formattedMessage = formatLolMessage(summonerData);
    
    // Send response
    return new ReturnMessage({
      chatId: chatId,
      content: formattedMessage
    });
    
  } catch (error) {
    logger.error('Erro ao executar comando lol:');
    return new ReturnMessage({
      chatId: chatId,
      content: `Erro: ${error.message || 'Ocorreu um erro ao buscar o invocador.'}`
    });
  }
}


/**
 * Handles the Valorant command
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage or array of ReturnMessages
 */
async function handleValorantCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  
  try {
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um Riot ID com tagline e servidor (ex: !valorant NomeJogador#ABC-NA)'
      });
    }
    
    // Parse the Riot ID
    const { gameName, tagLine, server } = parseRiotId(args);
    
    if (!tagLine || !server) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um Riot ID completo com tagline e servidor (ex: NomeJogador#ABC-NA)'
      });
    }

    // Get player data
    const playerDataResponse = await axios.get(`https://vaccie.pythonanywhere.com/mmr/${gameName}/${tagLine}/${server}`);
    const rank = playerDataResponse.data.split(",")[0];
    const emojiRank = RANK_EMOJIS_VALORANT[rank] ?? "🏆";

    const formattedMessage = `🔫 *Valorant - ${gameName}#${tagLine} @ ${server}*\n\n${emojiRank} ${playerDataResponse.data}`;

    // Send response
    return new ReturnMessage({
      chatId: chatId,
      content: formattedMessage
    });
    
  } catch (error) {
    logger.error('Erro ao executar comando valorant:');
    return new ReturnMessage({
      chatId: chatId,
      content: `Erro: ${error.message || 'Ocorreu um erro ao buscar o jogador.'}`
    });
  }
}

// Define commands using Command class
const commands = [
  new Command({
    name: 'lol',
    description: 'Busca perfil de jogador de League of Legends',
    category: "jogos",
    reactions: {
      before: process.env.LOADING_EMOJI ?? "🌀",
      after: "🎮",
      error: "❌"
    },
    method: handleLolCommand
  }),
  
  new Command({
    name: 'valorant',
    description: 'Busca perfil de jogador de Valorant',
    category: "jogos",
    reactions: {
      before: process.env.LOADING_EMOJI ?? "🌀",
      after: "🔫",
      error: "❌"
    },
    method: handleValorantCommand
  })
];

// Registra os comandos
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };

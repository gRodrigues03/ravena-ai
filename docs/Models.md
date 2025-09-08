# Documentação dos Models

Aqui você encontrará a documentação detalhada de todos os modelos de dados utilizados no Ravenabot. Estes modelos definem as estruturas fundamentais usadas pelo bot para manipular e armazenar informações.

## Command

**Arquivo:** `src/models/Command.js`

O modelo `Command` representa um comando do bot com suas propriedades e comportamentos. Esta classe é a base para todos os comandos fixos e fornece estrutura consistente para definição de comandos.

### Propriedades Principais:

- **name**: Nome do comando (obrigatório)
- **aliases**: Nomes alternativos para o comando
- **description**: Descrição do comando
- **usage**: Exemplo de uso do comando
- **category**: Categoria do comando
- **group**: Indica se o comando deve ser agrupado com outros semelhantes
- **needsMedia**: Se o comando requer mídia
- **needsQuotedMsg**: Se o comando requer mensagem citada
- **needsArgs**: Se o comando requer argumentos
- **minArgs**: Número mínimo de argumentos
- **adminOnly**: Se apenas administradores podem usar
- **exclusive**: Lista de grupos onde o comando está disponível (para APIs pagas)
- **reactions**: Configurações de emoji para feedback (before, after, error, trigger)
- **cooldown**: Tempo mínimo entre usos (segundos)
- **timeout**: Tempo máximo de execução (segundos)
- **method**: Função que implementa o comando (obrigatória)
- **active**: Se o comando está ativo
- **hidden**: Se o comando deve ser oculto em listagens

### Métodos Principais:

- **isValid()**: Verifica se o comando tem todos os requisitos necessários
- **execute()**: Executa o comando e retorna o resultado
- **trackUsage()**: Registra um uso bem-sucedido do comando
- **checkCooldown()**: Verifica se o comando está em cooldown
- **toJSON()**: Converte a instância para um objeto simples para serialização
- **fromJSON()**: (Estático) Cria uma instância de Command a partir de um objeto simples

### Exemplo de Uso:

```javascript
const command = new Command({
  name: 'ping',
  description: 'Verifica se o bot está online',
  method: async (bot, message, args, group) => {
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Pong! 🏓'
    });
  },
  cooldown: 5
});
```

## Group

**Arquivo:** `src/models/Group.js`

O modelo `Group` representa um grupo do WhatsApp com suas propriedades e configurações. Esta classe armazena todas as configurações específicas de um grupo, como prefixo de comando, filtros e monitoramento de streams.

### Propriedades Principais:

- **id**: ID único do grupo
- **name**: Nome do grupo
- **prefix**: Prefixo de comando (padrão: '!')
- **paused**: Se o bot está pausado no grupo
- **additionalAdmins**: Lista de administradores adicionais
- **filters**: Configurações de filtros (nsfw, links, words, people)
- **twitch/kick/youtube**: Configurações de monitoramento de plataformas
- **greetings**: Configurações de mensagens de boas-vindas
- **farewells**: Configurações de mensagens de despedida
- **interact**: Configurações de interações automáticas
- **autoStt**: Se a conversão automática de voz para texto está ativada
- **ignoredNumbers**: Lista de números ignorados
- **nicks**: Lista de apelidos de usuários

### Métodos Principais:

- **toJSON()**: Converte a instância para um objeto simples para serialização
- **update()**: Atualiza propriedades do grupo
- **setRemoved()**: Define o grupo como removido
- **isMonitoring()**: Verifica se um canal específico está sendo monitorado
- **addMonitoring()**: Adiciona um canal para monitoramento
- **removeMonitoring()**: Remove um canal do monitoramento

### Exemplo de Uso:

```javascript
const group = new Group({
  id: '123456789@g.us',
  name: 'teste-grupo',
  prefix: '!',
  addedBy: '5551234567@c.us'
});

// Atualiza configurações
group.update({
  autoStt: true,
  prefix: '#'
});
```

## ReturnMessage

**Arquivo:** `src/models/ReturnMessage.js`

O modelo `ReturnMessage` representa uma mensagem estruturada a ser enviada pelo bot. Esta classe padroniza o formato de resposta para todos os comandos, permitindo um processamento consistente de respostas.

### Propriedades Principais:

- **chatId**: ID do chat para enviar a mensagem (obrigatório)
- **content**: Conteúdo da mensagem (texto ou mídia) (obrigatório)
- **options**: Configurações adicionais para envio
  - **linkPreview**: Se mostra preview de links
  - **caption**: Legenda para imagem ou vídeo
  - **quotedMessageId**: ID da mensagem a ser citada
  - **mentions**: IDs de usuários para mencionar
  - **sendMediaAsSticker**: Se envia mídia como sticker
- **reactions**: Configurações de reações com emoji
- **delay**: Milissegundos para atrasar antes de enviar
- **metadata**: Metadados personalizados para rastreamento

### Métodos Principais:

- **isValid()**: Verifica se a ReturnMessage possui propriedades obrigatórias
- **toJSON()**: Converte a instância para um objeto simples para serialização

### Exemplo de Uso:

```javascript
const response = new ReturnMessage({
  chatId: '123456789@g.us',
  content: 'Olá, grupo!',
  options: {
    quotedMessageId: message.origin.id._serialized,
    evoReply: message.origin
  },
  reactions: {
    after: "✅"
  }
});

// Para enviar mídia
const mediaResponse = new ReturnMessage({
  chatId: '123456789@g.us',
  content: mediaObject,
  options: {
    caption: 'Imagem enviada pelo bot'
  }
});
```

Este modelo é fundamental para a padronização das respostas do bot, garantindo que todas as mensagens enviadas tenham um formato consistente e completo.

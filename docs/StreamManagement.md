# Stream Management Commands Guide

Este guia explicará como configurar e usar os comandos de gerenciamento de streams para Twitch, Kick e YouTube.

## Comandos de Usuário

Estes comandos podem ser usados por qualquer usuário no grupo:

- `!streams` - Lista todos os canais configurados para monitoramento no grupo
- `!streamstatus` - Mostra o status atual dos canais monitorados (online/offline)

## Comandos de Administrador (Gerenciamento)

Estes comandos seguem o formato `!g-xxx-yyy` onde `xxx` é a plataforma (twitch, kick, youtube) e `yyy` é a ação.

### Comandos da Twitch

- `!g-twitch-canal [canal]` - Ativa/desativa monitoramento do canal especificado
- `!g-twitch-midia-on [canal]` - Define a notificação quando o canal ficar online (deve ser usado como resposta a uma mensagem ou mídia)
- `!g-twitch-midia-off [canal]` - Define a notificação quando o canal ficar offline
- `!g-twitch-mudarTitulo [canal]` - Ativa/desativa alteração do título do grupo em eventos
- `!g-twitch-titulo-on [canal] [título]` - Define título personalizado quando o canal ficar online
- `!g-twitch-titulo-off [canal] [título]` - Define título personalizado quando o canal ficar offline
- `!g-twitch-usarIA [canal]` - Ativa/desativa geração de mensagens com IA em eventos

### Comandos do Kick

- `!g-kick-canal [canal]` - Ativa/desativa monitoramento do canal especificado
- `!g-kick-midia-on [canal]` - Define a notificação quando o canal ficar online
- `!g-kick-midia-off [canal]` - Define a notificação quando o canal ficar offline
- `!g-kick-mudarTitulo [canal]` - Ativa/desativa alteração do título do grupo em eventos
- `!g-kick-titulo-on [canal] [título]` - Define título personalizado quando o canal ficar online
- `!g-kick-titulo-off [canal] [título]` - Define título personalizado quando o canal ficar offline
- `!g-kick-usarIA [canal]` - Ativa/desativa geração de mensagens com IA em eventos

### Comandos do YouTube

- `!g-youtube-canal [canal]` - Ativa/desativa monitoramento do canal especificado
- `!g-youtube-midia-on [canal]` - Define a notificação para novos vídeos
- `!g-youtube-midia-off [canal]` - Define a notificação quando uma live terminar
- `!g-youtube-mudarTitulo [canal]` - Ativa/desativa alteração do título do grupo em eventos
- `!g-youtube-titulo-on [canal] [título]` - Define título personalizado para novos vídeos
- `!g-youtube-titulo-off [canal] [título]` - Define título personalizado quando uma live terminar
- `!g-youtube-usarIA [canal]` - Ativa/desativa geração de mensagens com IA em eventos

## Variáveis para Notificações

Ao definir notificações de texto ou legendas de mídia, você pode usar as seguintes variáveis:

### Para Twitch e Kick:
- `{nomeCanal}` - Nome do canal
- `{titulo}` - Título da stream
- `{jogo}` - Jogo sendo transmitido

### Para YouTube:
- `{author}` - Nome do canal
- `{title}` - Título do vídeo
- `{link}` - Link do vídeo

## Exemplos de Uso

### Configurar um Canal da Twitch
```
!g-twitch-canal nomeDoCanal
```

### Definir Notificação Online
1. Crie a mensagem de notificação (pode incluir texto, imagem, vídeo, áudio ou sticker)
2. Responda a essa mensagem com:
```
!g-twitch-midia-on nomeDoCanal
```

### Ativar Alteração de Título
```
!g-twitch-mudarTitulo nomeDoCanal
```

### Definir Título Personalizado
```
!g-twitch-titulo-on nomeDoCanal 🟢 Canal Ativo: {nomeDoCanal}
```

### Remover Configuração
Para remover uma configuração, use o comando sem parâmetros adicionais:
```
!g-twitch-midia-off nomeDoCanal
```

### Verificar Status dos Canais
```
!streamstatus
```

## Observações

- Para que a alteração de título funcione, o bot precisa ser administrador do grupo
- Se apenas um canal estiver configurado, você pode omitir o nome do canal nos comandos
- As notificações são enviadas automaticamente quando um canal muda de estado (online/offline)
- O monitoramento ocorre em intervalos regulares (aproximadamente a cada 1 minuto)

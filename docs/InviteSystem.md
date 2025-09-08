# Sistema de Convites

O Sistema de Convites permite que usuários adicionem o bot a grupos através de um fluxo de aprovação controlado, garantindo que o bot seja adicionado apenas a grupos autorizados e rastreando quem fez cada convite.

## Introdução

O InviteSystem proporciona um processo estruturado para adicionar o bot a grupos do WhatsApp. Quando um usuário envia um link de convite ao bot em uma conversa privada, o sistema:

1. Solicita o motivo para adicionar o bot
2. Encaminha o convite para um grupo de administradores para aprovação
3. Rastreia quem enviou o convite original
4. Concede privilégios de admin adicional para o convidador quando o bot entra no grupo

## Fluxo de Trabalho

```mermaid
flowchart TD
    A[Usuário envia link de convite para o bot] --> B[Bot pede motivo do convite]
    B --> C{Usuário responde?}
    C -->|Sim| D[Usuário envia motivo]
    C -->|Timeout| E[Bot usa "Nenhum motivo fornecido"]
    D --> F[Bot encaminha convite e motivo para grupo de aprovação]
    E --> F
    F --> G[Admin aprova usando !g-joinGrupo]
    G --> H[Bot entra no grupo via link de convite]
    H --> I[Bot identifica o autor original do convite]
    I --> J[Autor é adicionado como admin adicional]
    J --> K[Bot envia mensagem de boas-vindas]
```

## Componentes do Sistema

### 1. Reconhecimento de Convites
- Monitora conversas privadas para links de convite do formato "chat.whatsapp.com/XXXX"
- Extrai o código de convite para processamento

### 2. Coleta de Motivos
- Solicita ao usuário que explique por que deseja adicionar o bot
- Aguarda resposta por até 5 minutos
- Processa o motivo fornecido ou usa um padrão caso não haja resposta

### 3. Encaminhamento para Aprovação
- Envia o convite e motivo para um grupo designado (GRUPO_INVITES definido no .env)
- Formata a mensagem com detalhes do solicitante e o comando necessário para aprovação

### 4. Aprovação e Entrada no Grupo
- Administradores podem aprovar com o comando `!g-joinGrupo <código> <autorId> <autorNome>`
- O sistema rastreia metadados do convite para associá-lo ao grupo correto após a entrada

### 5. Rastreamento e Privilégios
- Quando o bot entra em um grupo, identifica o autor original do convite
- Adiciona o autor como administrador adicional no grupo (propriedade `additionalAdmins`)
- Envia mensagem personalizada agradecendo ao autor do convite

## Comandos Disponíveis

| Comando | Descrição | Permissão |
|---------|-----------|-----------|
| `!g-joinGrupo <código> [autorId] [autorNome]` | Aceita um convite de grupo | Administradores |
| `!g-customAdmin <número>` | Adiciona/remove admin adicional (sem permissões de grupo) | Administradores |

## Exemplo de Uso

### Processo do usuário

1. Usuário envia link de convite (`https://chat.whatsapp.com/AbCdEfGh12345`) para o bot em chat privado
2. Bot responde: "Obrigado pelo convite! Por favor, me diga por que você quer me adicionar a este grupo."
3. Usuário responde: "Preciso do bot para ajudar com comandos de clima e stickers"
4. Bot confirma: "Obrigado! Seu convite foi recebido e será analisado em breve."

### Processo do administrador

1. No grupo de aprovação (GRUPO_INVITES), o bot envia:
   ```
   📩 Nova Solicitação de Convite de Grupo
   
   👤 De: João Silva (5512345678901@c.us)
   
   💬 Motivo:
   Preciso do bot para ajudar com comandos de clima e stickers
   
   Para aceitar este convite, use o comando:
   
   !g-joinGrupo AbCdEfGh12345 5512345678901@c.us João Silva
   ```

2. Admin usa o comando `!g-joinGrupo AbCdEfGh12345 5512345678901@c.us João Silva` para aprovar
3. Bot entra no grupo e identifica o autor original
4. João Silva é adicionado como admin adicional do bot no grupo
5. Bot envia mensagem de boas-vindas incluindo um agradecimento a João pelo convite

## Administradores Adicionais

O sistema mantém uma lista de "administradores adicionais" para cada grupo, que são usuários com privilégios especiais em relação ao bot, mas não necessariamente administradores do grupo no WhatsApp.

### Características:
- Armazenados na propriedade `additionalAdmins` no modelo Group.js
- Formato: array de números de telefone (`["12345678901@c.us"]`)
- Podem ser gerenciados com o comando `!g-customAdmin`
- O convidador original do bot é automaticamente adicionado a esta lista

### Gerenciamento de Admins Adicionais

Para adicionar ou remover administradores adicionais:

```
!g-customAdmin 5512345678901
```

Este comando alterna o status do número, adicionando-o se não estiver na lista ou removendo-o se já estiver. O bot responderá com a lista atualizada de administradores adicionais no formato `+55 (12) 91234-5678`.

## Configuração

Para habilitar o sistema de convites, configure as seguintes variáveis no arquivo `.env`:

```env
# ID do grupo para receber solicitações de convite (formato: 1234567890@g.us)
GRUPO_INVITES=1234567890@g.us
```

## Notas Importantes

1. O sistema de convites apenas funciona em chats privados para o processo inicial
2. O comando de aprovação só funcionará quando usado no grupo GRUPO_INVITES designado
3. Se o sistema não conseguir identificar o autor do convite após entrar no grupo, não haverá adição automática como admin adicional
4. Os administradores adicionais têm permissões apenas em relação ao bot, não afetando as permissões de grupo do WhatsApp
5. As solicitações de convite têm um timeout de 5 minutos para o motivo

# Comandos de Doação

Este módulo implementa comandos para visualização de informações sobre doações e doadores no bot WhatsApp. O sistema permite que usuários possam ver detalhes de doações, links de doação e um ranking dos principais doadores.

## Funcionamento

O sistema de doações funciona em conjunto com a plataforma [Tipa.ai](https://tipa.ai), que é um serviço de recebimento de doações via PIX ou outros métodos de pagamento. O bot recebe notificações de doações através de um webhook configurado na API e armazena essas informações em um banco de dados para consulta posterior.

### Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `!donate` | Mostra informações de doação e link |
| `!doar` | Alias em português do comando donate |
| `!doadores` | Mostra lista dos principais doadores |
| `!donors` | Alias em inglês do comando doadores |

## Detalhes da Implementação

O módulo utiliza a biblioteca padrão do Node.js para operações e se integra com o sistema de banco de dados do bot para armazenar e recuperar informações sobre doações. Essas informações incluem:

- Nome do doador
- Valor doado
- Data da doação

Além disso, o sistema também é capaz de mostrar o progresso atual em relação a uma meta de doação, se configurada no arquivo `.env` do bot.

### Integração com Tipa.ai via BotAPI

O bot possui uma API REST implementada no arquivo `BotAPI.js` que expõe um endpoint `/donate_tipa` para receber webhooks do Tipa.ai. Quando uma doação é feita na plataforma, o Tipa.ai envia uma notificação para este endpoint contendo informações sobre a doação:

1. O webhook verifica a autenticidade da requisição através de um token no cabeçalho `x-tipa-webhook-secret-token`
2. Extrai os detalhes da doação (nome do doador, valor, mensagem)
3. Armazena a doação no banco de dados
4. Notifica os grupos configurados sobre a nova doação

Os grupos notificados são:
- `grupoLogs`: Grupo para registro de atividades do bot
- `grupoAvisos`: Grupo principal de avisos
- `grupoInteracao`: Grupo de interação geral

As mensagens de notificação de doação são fixadas nos grupos por um período proporcional ao valor doado, com base no cálculo: `600 + (valor * 300)` segundos.

## Configuração

Para configurar o sistema de doações, as seguintes variáveis devem ser definidas no arquivo `.env`:

```env
# Link para doações
DONATION_LINK=https://tipa.ai/seunome

# Meta de doação (opcional)
DONATION_GOAL_AMOUNT=100
DONATION_GOAL_DESCRIPTION=Comprar um novo servidor

# Token de webhook do Tipa.ai
TIPA_TOKEN=seu_token_secreto

# IDs dos grupos para notificação
GRUPO_LOGS=1234567890@g.us
GRUPO_AVISOS=1234567890@g.us
GRUPO_INTERACAO=1234567890@g.us
```

## Exemplos de Uso

### Comando `!donate` ou `!doar`

**Entrada:**
```
!donate
```

**Saída:**
```
💖 Apoie-nos com uma doação! 💖

Suas doações nos ajudam a manter e melhorar este bot.

🔗 Link de Doação: https://tipa.ai/seunome

Use !donors ou !doadores para ver uma lista de doadores que já contribuíram. Obrigado!
```

### Comando `!doadores` ou `!donors`

**Entrada:**
```
!doadores
```

**Saída:**
```
🏆 Principais Doadores 🏆

Obrigado a todos os nossos apoiadores! Total de doações: R$85.50

1. João Silva: R$30.00
2. Maria Oliveira: R$25.50
3. Carlos Santos: R$20.00
4. Ana Pereira: R$10.00

Use !donate ou !doar para nos apoiar também!
```

### Exemplo de notificação de doação nos grupos

Quando alguém faz uma doação através do Tipa.ai, o bot envia automaticamente uma mensagem como esta:

```
💸 Recebemos um DONATE no tipa.ai! 🥳

*MUITO obrigado* pelos R$15.00, Roberto! 🥰
Compartilho aqui com todos sua mensagem:
💬 Parabéns pelo ótimo trabalho! Continuem assim.

!doar ou !donate pra conhecer os outros apoiadores e doar também
```

## Notas Adicionais

- As doações são armazenadas permanentemente no banco de dados
- O comando `!doadores` mostra apenas os 10 principais doadores
- É possível que administradores adicionem doações manualmente usando comandos de gerenciamento como `!g-addDonateNumero` e `!g-addDonateValor`
- O comando `!g-addDonateNumero` serve para associar o número de WhatsApp de um doador ao seu registro, permitindo que quando um usuário doador envie um convite para o bot, esta informação seja destacada na notificação de convite, dando prioridade ao convite deste usuário
- O sistema mantém um total acumulado para cada doador, permitindo que um mesmo doador faça múltiplas doações

# Comandos de Menu

Este módulo implementa funcionalidades para exibir listas de comandos disponíveis, comandos personalizados e comandos de gerenciamento.

## Comandos

### !cmd / !menu

Mostra todos os comandos disponíveis.

**Descrição:** Exibe uma lista organizada de todos os comandos disponíveis, agrupados por categoria.

**Uso:** `!cmd` ou `!menu`

**Detalhes:**
- Lista comandos fixos organizados por categoria (Geral, Grupo, Utilidades, Mídia, IA, etc.)
- Inclui descrição curta de cada comando
- Exibe reações associadas (emoji de gatilho) quando aplicável
- Agrupa comandos relacionados para melhor organização
- Inclui também a lista de comandos de gerenciamento

### !cmd-grupo

Mostra comandos personalizados do grupo.

**Descrição:** Lista todos os comandos personalizados criados especificamente para o grupo atual.

**Uso:** `!cmd-grupo`

**Detalhes:**
- Exibe apenas comandos personalizados do grupo atual
- Mostra reações associadas quando configuradas
- Inclui contagem de uso de cada comando
- Indica número de respostas para comandos com múltiplas respostas
- Adiciona informações sobre como gerenciar comandos personalizados

### !cmd-gerenciamento / !cmd-g

Mostra comandos de gerenciamento do grupo.

**Descrição:** Lista todos os comandos de gerenciamento disponíveis para administradores.

**Uso:** `!cmd-gerenciamento` ou `!cmd-g`

**Detalhes:**
- Exibe comandos específicos para gerenciamento de grupos
- Lista comandos que começam com o prefixo !g-
- Inclui descrição detalhada de cada comando
- Organiza comandos em ordem lógica de utilidade

## Organização dos Comandos

O sistema de menu organiza os comandos das seguintes formas:

### Categorias

Os comandos fixos são organizados nas seguintes categorias:
- 📃 **Geral** - Comandos básicos e de utilidade geral
- 👥 **Grupo** - Comandos para interação e gestão de grupos
- 🛠️ **Utilidades** - Ferramentas e recursos diversos
- 📱 **Mídia** - Comandos para manipulação de arquivos e mídia
- 🤖 **IA** - Comandos que utilizam inteligência artificial
- 📤 **Downloaders** - Comandos para download de conteúdo
- 🎮 **Jogos** - Comandos relacionados a jogos e diversão
- 🍿 **Cultura** - Comandos para buscar informações culturais
- 🔈 **Áudio** - Comandos para manipulação de áudio
- 🗣 **TTS** - Comandos de conversão de texto para voz
- 🔎 **Busca** - Comandos de pesquisa e busca online
- 📜 **Listas** - Comandos para criar e gerenciar listas
- 📂 **Arquivos** - Sistema de armazenamento de arquivos

### Agrupamento

Comandos relacionados são agrupados para facilitar a visualização:
- Comandos com funções similares são exibidos juntos
- Aliases são mostrados na mesma linha (ex: !ai, !ia, !gpt)
- Variações são agrupadas (ex: diferentes vozes de TTS)

### Ordenação

Os comandos seguem uma ordem específica para facilitar o uso:
- Comandos mais comuns aparecem primeiro
- Comandos da mesma categoria são agrupados
- Organização hierárquica para comandos relacionados

## Código-fonte

Este módulo está implementado no arquivo `src/functions/Menu.js` e utiliza:
- Sistema de categorização baseado em metadados dos comandos
- Emojis para representação visual das categorias
- Algoritmos de ordenação personalizados
- Integração com sistema de comandos personalizados

## Personalização

O menu pode ser personalizado através dos seguintes arquivos:
- `data/textos/cmd_header.txt` - Altera o cabeçalho do menu de comandos
- Arquivos de configuração para alterar emojis e organização

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*

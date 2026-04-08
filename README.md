# Idle Tab Grouper

Extensão Chrome em `TypeScript + Vite` para agrupar e descartar abas automaticamente depois de ficarem inativas por um tempo.

## O que ela faz

- Agrupa por alias de site e por palavras-chave de assunto
- Descarta abas ociosas com um threshold único de otimização
- Nunca cria grupo com apenas 1 aba
- Recolhe grupos inativos para economizar espaço
- Mostra economia estimada de RAM usando apenas dados locais
- Mostra uma notificação no ícone quando precisa cair para fallback
- Permite renomear, recolher e desagrupar grupos manualmente
- Permite alternar entre:
  - `auto`: move a aba para o grupo
  - `suggest`: apenas marca a aba como candidata
- Deixa regras customizáveis no popup
- Sincroniza as configurações pelo `chrome.storage.sync`

## Como testar localmente

1. Instale as dependências com `npm install`
2. Rode `npm run build`
3. Abra `chrome://extensions`
4. Ative `Developer mode`
5. Clique em `Load unpacked`
6. Selecione a pasta `dist`

Para desenvolvimento contínuo:

1. Rode `npm run dev`
2. Refaça o load da pasta `dist` no Chrome quando necessário

## Ajustes rápidos

- `behavior`: muda entre mover automaticamente e só sugerir
- `strategy`: escolhe entre `hybrid`, `subject` e `site`
- `inactivityMinutes`: define quanto tempo a aba precisa ficar sem foco
- `optimizationPreset`: alterna entre `Agressivo`, `Equilibrado` e `Conservador`
- `minimumTabsToGroup`: define o mínimo de abas para formar grupo
- `collapseInactiveGroups`: recolhe grupos com todos os tabs inativos
- `Aliases de sites`: troca `google.com` por `Google`, `clickup.com` por `ClickUp` e assim por diante
- `Regras de assunto`: define grupos por keywords
- `Grupos atuais`: renomeia ou desagrupa qualquer grupo já existente

## Próximo passo útil

Se o teste local funcionar, o próximo passo natural é:

- persistir mais metadados dos grupos
- criar presets de regras por perfil de uso
- melhorar a heurística de domínio para subdomínios mais finos

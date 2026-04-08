## Why

A extensão já agrupa abas inativas, mas ainda não recupera memória do navegador das abas que continuam abertas e sem uso. Queremos transformar o tratamento de inatividade em um fluxo de otimização mais completo, mantendo a extensão segura, leve e mais simples de publicar com confiança na Chrome Web Store.

## What Changes

- Adicionar um threshold único de inatividade que agrupa abas elegíveis e depois as descarta na mesma passada de otimização.
- Introduzir presets de otimização voltados ao usuário, com `5 min` como padrão e alternativas de `2 min` e `10 min`.
- Adicionar um insight leve no popup mostrando apenas a economia estimada de RAM calculada localmente.
- Armazenar analytics de RAM apenas localmente, com retenção curta e sem telemetria baseada em sync.
- Endurecer a extensão contra riscos comuns da Chrome Web Store, reforçando regras seguras de descarte, reduzindo ambiguidades de privacidade e mantendo runtime/pacote enxutos.

## Capabilities

### New Capabilities
- `idle-tab-discard`: Agrupar e descartar abas inativas elegíveis usando um único threshold de inatividade e regras de segurança.
- `ram-savings-insights`: Exibir no popup a economia estimada de RAM para abas descartadas, com histórico leve.
- `extension-hardening`: Definir guardrails de segurança, privacidade, empacotamento e performance necessários para entregar o fluxo de otimização com segurança.

### Modified Capabilities
Nenhuma.

## Impact

- Afeta o fluxo de varredura de inatividade no service worker MV3 em `dist/background.js`.
- Estende a persistência de configurações e analytics em `dist/assets/storage-BA3POQI9.js`.
- Atualiza os controles do popup e a UI de resumo em `dist/assets/popup-DlIN7ggC.js` e `dist/popup.html`.
- Altera expectativas de build/release para o pacote da Web Store, incluindo analytics apenas locais e artefatos publicados mais enxutos.

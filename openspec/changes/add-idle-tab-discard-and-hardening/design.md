## Context

A extensão atual já varre abas em um alarme periódico de background MV3, agrupa abas inativas por alias ou assunto e recolhe grupos inativos. Ela não recupera memória de abas ociosas e hoje armazena apenas configurações e dados de resumo da última execução. Esta mudança adiciona um fluxo de otimização mais forte, que agrupa abas elegíveis e depois as descarta, além de incluir um insight leve de RAM e endurecer a extensão contra problemas comuns de segurança e performance da Chrome Web Store.

Este design é transversal porque toca o pipeline de varredura no background, os controles do popup, o armazenamento local de analytics e as expectativas de empacotamento/release. O projeto ainda não possui specs de capabilities no OpenSpec, então esta change também define o primeiro contrato de comportamento para otimização, insights locais e hardening.

## Goals / Non-Goals

**Goals:**
- Usar um único threshold de inatividade para agrupamento e descarte.
- Definir o preset equilibrado em 5 minutos como padrão, com suporte também a 2 e 10 minutos.
- Proteger o fluxo do usuário descartando apenas abas claramente elegíveis.
- Manter analytics locais, pequenos e fáceis de entender.
- Manter a extensão leve em overhead de runtime e tamanho de pacote.
- Tornar o comportamento final e os disclosures ao usuário defensáveis para revisão na Chrome Web Store.

**Non-Goals:**
- Medir uso real de RAM por aba.
- Medir economia de CPU.
- Introduzir telemetria remota, serviços externos ou host permissions.
- Reescrever todo o sistema de renderização do popup nesta change.
- Adicionar políticas customizadas de descarte por site na v1.

## Decisions

### 1. Group and discard will share one threshold
Vamos usar uma única configuração de inatividade para decidir quando as abas entram no fluxo de otimização. Quando uma aba estiver elegível, o service worker irá classificá-la, agrupá-la quando aplicável e então descartá-la se passar pelo filtro de segurança de descarte.

Rationale:
- Mantém o modelo mental do usuário simples.
- Evita edge cases em que o descarte aconteceria antes do agrupamento por causa de timers diferentes.
- Se encaixa na arquitetura atual de varredura no background com complexidade mínima adicional de agendamento.

Alternatives considered:
- Thresholds separados para agrupamento e descarte: mais flexível, mas introduz ordem de operação confusa e mais complexidade de configuração.
- Fluxo apenas de descarte: recupera memória, mas perde o objetivo do projeto de organizar a barra de abas.

### 2. The default preset will be 5 minutes
A extensão irá expor presets chamados Agressivo, Equilibrado e Conservador, mapeados respectivamente para 2, 5 e 10 minutos, com 5 minutos como padrão.

Rationale:
- 5 minutos é menos disruptivo do que 2 minutos para fluxos comuns de navegação.
- Presets reduzem o custo de configuração, ainda permitindo uma otimização mais agressiva.

Alternatives considered:
- Padrão em 2 minutos: alivia melhor a pressão de memória, mas aumenta bastante o risco de frustração do usuário.
- Somente input manual numérico: flexível, mas com UX pior e mais difícil de comunicar com segurança.

### 3. Discard eligibility will use strict exclusions
Abas SHALL ser excluídas do descarte quando estiverem ativas, pinned, com áudio, já descartadas ou usando URLs internas protegidas. O agrupamento ainda pode se aplicar com base na lógica de elegibilidade existente, mas o descarte só deve rodar para abas que satisfaçam o filtro mais restritivo.

Rationale:
- Minimiza a interrupção da intenção do usuário.
- Se alinha a expectativas comuns de segurança para extensões.

Alternatives considered:
- Descartar toda aba inativa: implementação mais simples, porém arriscada demais para a UX.
- Manter uma grande lista embutida de sites sensíveis: pode ajudar em alguns casos, mas é frágil e cara de manter para a v1.

### 4. RAM analytics will be estimated and stored only in local aggregated form
O popup mostrará apenas economia estimada de RAM. O worker de background vai agregar totais por dia em armazenamento local e manter apenas uma janela curta de histórico. Nenhum analytics será gravado em sync storage.

Rationale:
- O Chrome não expõe uso confiável de memória por aba para esse caso.
- Agregados locais evitam preocupações de privacidade, pressão de quota no sync e escritas excessivas em storage.

Alternatives considered:
- Sincronizar analytics entre navegadores: cria custo desnecessário de privacidade e quota.
- Registrar eventos brutos de descarte para sempre: aumenta storage e overhead de processamento sem valor claro.

### 5. Hardening is part of the feature, not a follow-up
Esta change vai incluir explicitamente limites de armazenamento apenas local, expectativas de empacotamento, requisitos de disclosure e restrições para manter o runtime enxuto.

Rationale:
- A nova feature aumenta a consequência de um comportamento incorreto.
- O risco de revisão na Web Store é menor quando o uso de permissões e o processamento apenas local estão claros desde o início.

Alternatives considered:
- Tratar hardening apenas como documentação: mais rápido no início, mas deixa os critérios de aceite ambíguos.

## Risks / Trade-offs

- [Descartar uma aba recarrega seu estado quando ela é revisitada] -> Excluir abas ativas, pinned, com áudio, já descartadas e URLs internas protegidas; manter 5 minutos como preset padrão.
- [RAM estimada pode ser interpretada como RAM medida] -> Rotular a UI claramente como estimativa e limitar a métrica apenas a RAM.
- [Varreduras no background podem ficar mais caras com muitos tabs] -> Manter o alarme em um minuto, filtrar abas inelegíveis cedo e armazenar apenas agregados diários.
- [O uso de `innerHTML` no popup continua sendo um risco futuro de injeção] -> Evitar introduzir novos campos dinâmicos sem sanitização nesta change e registrar hardening adicional de DOM como trabalho futuro.
- [Publicar artefatos de debug pode expor detalhes internos desnecessários] -> Excluir sourcemaps do pacote final da Chrome Web Store.

## Migration Plan

1. Estender os defaults de configuração para incluir metadados de preset, enablement de descarte e configuração de estimativa de RAM.
2. Adicionar filtro seguro de descarte e agregação local de RAM ao fluxo de varredura no background.
3. Atualizar o popup para expor os presets e mostrar o insight de RAM.
4. Validar o conteúdo do pacote destinado à publicação e remover sourcemaps do artefato de release.
5. Fazer rollback desabilitando o descarte nos defaults e preservando o fluxo atual de agrupamento caso apareçam regressões.

## Open Questions

- O input manual de minutos deve entrar na v1, ou o primeiro release deve expor apenas presets?
- A estimativa de RAM deve usar um único valor padrão ou um multiplicador específico por preset?
- Queremos uma nota visível de disclosure dentro do popup, na descrição da store, ou em ambos?

## 1. Settings and data model

- [x] 1.1 Estender as configurações padrão para incluir metadados de preset de otimização, enablement de descarte e configuração de RAM estimada.
- [x] 1.2 Definir uma estrutura de analytics apenas local para agregados diários de economia de RAM e retenção curta.
- [x] 1.3 Garantir que os analytics de RAM sejam armazenados fora dos caminhos de settings baseados em sync.

## 2. Background optimization flow

- [x] 2.1 Atualizar o pipeline de varredura de inatividade para usar um único threshold compartilhado entre agrupamento e descarte.
- [x] 2.2 Implementar filtros seguros de descarte para abas ativas, pinned, com áudio, já descartadas e URLs internas protegidas.
- [x] 2.3 Executar as decisões de agrupamento antes do descarte na mesma passada de otimização.
- [x] 2.4 Registrar localmente agregados da estimativa de RAM quando ações de descarte ocorrerem.
- [x] 2.5 Manter a cadência da varredura leve e preservar o fluxo atual de agrupamento como fallback para rollback seguro.

## 3. Popup experience

- [x] 3.1 Adicionar presets de otimização voltados ao usuário para os modos agressivo, equilibrado e conservador.
- [x] 3.2 Atualizar o popup para mostrar apenas RAM estimada economizada e um histórico leve.
- [x] 3.3 Adicionar textos que indiquem que a RAM é uma estimativa e expliquem claramente o comportamento apenas local.

## 4. Hardening and release readiness

- [x] 4.1 Revisar os novos campos dinâmicos do popup para evitar introduzir caminhos de renderização sem sanitização.
- [x] 4.2 Manter a retenção dos analytics de RAM limitada e remover automaticamente agregados locais expirados.
- [x] 4.3 Excluir sourcemaps e outros artefatos de debug não essenciais do pacote de release para a Chrome Web Store.
- [x] 4.4 Validar que a extensão continua operando sem adicionar host permissions, chamadas de rede ou telemetria remota.

## 5. Verification

- [x] 5.1 Verificar defaults de preset e mudanças de threshold em um fluxo de instalação nova.
- [x] 5.2 Verificar que abas protegidas nunca são descartadas durante as varreduras de inatividade.
- [x] 5.3 Verificar que os analytics de RAM permanecem locais e não são gravados em sync storage.
- [x] 5.4 Verificar que o popup lida sem erro com analytics vazios, analytics ativos e histórico retido.

## 6. Validation discipline

- [x] 6.1 Derivar os testes principais a partir das regras descritas nas specs, e não a partir dos detalhes da implementação atual.
- [x] 6.2 Cobrir cada regra crítica com pelo menos um caso positivo e um caso negativo.
- [x] 6.3 Extrair e validar lógica pura sempre que possível, usando mocks apenas nas bordas do runtime do Chrome.
- [x] 6.4 Evitar testes que apenas confirmem chamadas mockadas sem validar comportamento observável.
- [ ] 6.5 Confirmar que regras críticas falham em teste quando a proteção correspondente é removida ou quebrada de propósito.
- [x] 6.6 Revisar falhas de teste comparando primeiro spec, comportamento esperado e implementação antes de ajustar o próprio teste.

import "./styles/popup.css";

import { DEFAULT_SETTINGS } from "./shared/defaults";
import { createRuleId, fromStoredAliases, fromStoredRules, normalizeDomain, toRuleKeywords } from "./shared/rules";
import { readSettings, readSession, writeSettings } from "./shared/storage";
import type { DomainAlias, ExtensionSettings, TabGroupColor, TabRule } from "./shared/types";

type GroupSnapshot = {
  collapsed: boolean;
  color: TabGroupColor;
  id: number;
  tabCount: number;
  title: string;
  windowId: number;
};

const app = getAppRoot();

let state: ExtensionSettings = { ...DEFAULT_SETTINGS };
let latestSession: Awaited<ReturnType<typeof readSession>> | null = null;
let latestGroups: GroupSnapshot[] = [];

init().catch(error => {
  console.error("Failed to init popup", error);
  app.innerHTML = `<div class="error">Falha ao carregar a extensão: ${String(error instanceof Error ? error.message : error)}</div>`;
});

async function init(): Promise<void> {
  const [settings, session, groups] = await Promise.all([readSettings(), readSession(), loadGroupSnapshot()]);
  state = {
    ...settings,
    domainAliases: fromStoredAliases(settings.domainAliases),
    customRules: fromStoredRules(settings.customRules)
  };
  latestSession = session;
  latestGroups = groups;
  render();
}

function getAppRoot(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) {
    throw new Error("Popup app container not found");
  }
  return element;
}

function render(): void {
  const statusSummary = latestSession?.lastSummary || null;
  const currentModeLabel = state.behavior === "auto" ? "Automatico" : "Sugestoes";
  const strategyLabel = state.strategy === "hybrid" ? "Hibrido" : state.strategy === "subject" ? "Assunto" : "Site";

  app.innerHTML = `
    <main class="shell">
      <section class="topbar">
        <div class="brand-pill">
          <span class="brand-mark"></span>
          <span>Idle Tab Grouper</span>
        </div>
        <div class="topbar-status">
          <span class="status-dot"></span>
          <span>${state.enabled ? "Ativo" : "Pausado"}</span>
        </div>
      </section>

      <section class="panel hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Tab workflow studio</p>
          <p class="lede hero-lede">Agrupe abas inativas por alias ou assunto, recolha grupos esquecidos e ajuste tudo num painel mais limpo e rapido de operar.</p>
          <div class="hero-actions">
            <button id="scan" class="primary">Agrupar agora</button>
            <button id="save" class="secondary">Salvar ajustes</button>
          </div>
        </div>
      </section>

      <section class="stats-grid">
        <article class="stat-card stat-accent">
          <span class="stat-label">Modo</span>
          <strong>${currentModeLabel}</strong>
          <small>${state.enabled ? "Monitorando abas em segundo plano" : "Sem automacoes ativas"}</small>
        </article>
        <article class="stat-card">
          <span class="stat-label">Janela de idle</span>
          <strong>${state.inactivityMinutes} min</strong>
          <small>Estrategia ${strategyLabel.toLowerCase()}</small>
        </article>
        <article class="stat-card stat-dark">
          <span class="stat-label">Grupos vivos</span>
          <strong>${latestGroups.length}</strong>
          <small>${formatSummary(statusSummary)}</small>
        </article>
      </section>

      <div class="section-kicker">Setup</div>
      <details class="panel accordion settings-panel">
        <summary class="accordion-summary">
          <div>
            <h2>Motor de agrupamento</h2>
            <p>Controle o comportamento automatico da extensao.</p>
          </div>
          <span class="accordion-indicator" aria-hidden="true"></span>
        </summary>
        <div class="accordion-content settings-grid">
          <label class="field-card toggle-row">
            <span>
              <strong>Ativar extensao</strong>
              <small>Quando desligada, a extensao so observa os dados salvos.</small>
            </span>
            <input id="enabled" type="checkbox" ${state.enabled ? "checked" : ""} />
          </label>

          <label class="field-card">
            <span>Comportamento</span>
            <select id="behavior">
              <option value="auto" ${state.behavior === "auto" ? "selected" : ""}>Mover automaticamente</option>
              <option value="suggest" ${state.behavior === "suggest" ? "selected" : ""}>So sugerir</option>
            </select>
          </label>

          <label class="field-card">
            <span>Estrategia</span>
            <select id="strategy">
              <option value="hybrid" ${state.strategy === "hybrid" ? "selected" : ""}>Hibrido</option>
              <option value="subject" ${state.strategy === "subject" ? "selected" : ""}>So assunto</option>
              <option value="site" ${state.strategy === "site" ? "selected" : ""}>So site</option>
            </select>
          </label>

          <label class="field-card">
            <span>Inatividade minima</span>
            <div class="inline-field">
              <input id="inactivityMinutes" type="number" min="1" max="60" step="1" value="${state.inactivityMinutes}" />
              <span>min</span>
            </div>
          </label>

          <label class="field-card">
            <span>Minimo de abas para agrupar</span>
            <div class="inline-field">
              <input id="minimumTabsToGroup" type="number" min="2" max="50" step="1" value="${state.minimumTabsToGroup}" />
              <span>abas</span>
            </div>
          </label>

          <label class="field-card toggle-row">
            <span>
              <strong>Recolher grupos inativos</strong>
              <small>Quando todos os tabs do grupo estao parados, o grupo vira um bloco compacto.</small>
            </span>
            <input id="collapseInactiveGroups" type="checkbox" ${state.collapseInactiveGroups ? "checked" : ""} />
          </label>
        </div>
      </details>

      <div class="section-kicker">Services</div>
      <details class="panel accordion">
        <summary class="accordion-summary">
          <div>
            <h2>Aliases de sites</h2>
            <p>Ex.: <code>google.com</code> vira <code>Google</code>.</p>
          </div>
          <span class="accordion-indicator" aria-hidden="true"></span>
        </summary>
        <div class="accordion-actions">
          <button id="addAlias" class="secondary" type="button">Adicionar alias</button>
        </div>
        <div id="aliases" class="rules accordion-content"></div>
      </details>

      <section class="panel panel-dark">
        <div class="section-head">
          <div>
            <h2>Regras de assunto</h2>
            <p>Keywords separadas por virgula. Se baterem com 2 ou mais abas, a extensao cria o agrupamento.</p>
          </div>
          <button id="addRule" class="secondary">Adicionar regra</button>
        </div>
        <div id="rules" class="rules"></div>
      </section>

      <div class="section-kicker">Live status</div>
      <section class="panel status-band">
        <div>
          <span class="label">Ultima execucao</span>
          <strong id="lastRunAt">${latestSession?.lastRunAt ? new Date(latestSession.lastRunAt).toLocaleString() : "--"}</strong>
        </div>
        <div>
          <span class="label">Resumo</span>
          <strong id="lastSummary">${formatSummary(statusSummary)}</strong>
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Grupos atuais</h2>
            <p>Renomeie, recolha ou desagrupe tudo daqui sem sair do popup.</p>
          </div>
          <button id="refreshGroups" class="secondary">Atualizar</button>
        </div>
        <div class="actions actions-wrap">
          <button id="ungroupAll" class="secondary">Desagrupar tudo</button>
        </div>
        <div id="groups" class="groups"></div>
      </section>

      ${renderFallbackNotice(statusSummary)}
    </main>
  `;

  bindGeneralInputs();
  bindEditorButtons();
  bindActions();
  renderAliasEditor();
  renderRuleEditor();
  renderGroupEditor();
}

function bindGeneralInputs(): void {
  bindCheckbox("enabled", checked => {
    state.enabled = checked;
  });
  bindSelect("behavior", value => {
    state.behavior = value as ExtensionSettings["behavior"];
  });
  bindSelect("strategy", value => {
    state.strategy = value as ExtensionSettings["strategy"];
  });
  bindNumber("inactivityMinutes", value => {
    state.inactivityMinutes = value;
  });
  bindNumber("minimumTabsToGroup", value => {
    state.minimumTabsToGroup = Math.max(2, value);
  });
  bindCheckbox("collapseInactiveGroups", checked => {
    state.collapseInactiveGroups = checked;
  });
}

function bindEditorButtons(): void {
  const addAliasButton = document.querySelector<HTMLButtonElement>("#addAlias");
  const addRuleButton = document.querySelector<HTMLButtonElement>("#addRule");
  const refreshGroupsButton = document.querySelector<HTMLButtonElement>("#refreshGroups");
  const ungroupAllButton = document.querySelector<HTMLButtonElement>("#ungroupAll");

  addAliasButton?.addEventListener("click", () => {
    state.domainAliases = [
      ...state.domainAliases,
      {
        id: createRuleId(),
        domain: "",
        label: "Novo alias",
        color: "blue"
      }
    ];
    render();
  });

  addRuleButton?.addEventListener("click", () => {
    state.customRules = [
      ...state.customRules,
      {
        id: createRuleId(),
        name: "Nova regra",
        color: "blue",
        keywords: []
      }
    ];
    render();
  });

  refreshGroupsButton?.addEventListener("click", async () => {
    latestGroups = await loadGroupSnapshot();
    render();
  });

  ungroupAllButton?.addEventListener("click", async () => {
    await ungroupAllGroups();
    latestGroups = await loadGroupSnapshot();
    render();
  });
}

function bindActions(): void {
  const saveButton = document.querySelector<HTMLButtonElement>("#save");
  const scanButton = document.querySelector<HTMLButtonElement>("#scan");

  saveButton?.addEventListener("click", async () => {
    state.domainAliases = readAliasesFromDom();
    state.customRules = readRulesFromDom();
    await writeSettings(state);
    await flashButton(saveButton, "Salvo");
  });

  scanButton?.addEventListener("click", async () => {
    state.domainAliases = readAliasesFromDom();
    state.customRules = readRulesFromDom();
    await writeSettings(state);
    await chrome.runtime.sendMessage({ type: "idle-tab-grouper:scan-now" });
    latestSession = await readSession();
    latestGroups = await loadGroupSnapshot();
    render();
    const refreshedScanButton = document.querySelector<HTMLButtonElement>("#scan");
    if (refreshedScanButton) {
      await flashButton(refreshedScanButton, "Feito");
    }
  });
}

function renderAliasEditor(): void {
  const container = document.querySelector<HTMLDivElement>("#aliases");
  if (!container) return;

  container.innerHTML = state.domainAliases
    .map(
      (alias, index) => `
        <article class="rule-card" data-alias-id="${alias.id}">
          <header>
            <div>
              <strong>Alias ${index + 1}</strong>
              <small>Faça o domínio falar o nome que você quer ver.</small>
            </div>
            <button type="button" class="ghost" data-remove-alias="${alias.id}">Remover</button>
          </header>
          <label>
            <span>Domínio</span>
            <input data-field="domain" type="text" value="${escapeHtml(alias.domain)}" placeholder="google.com" />
          </label>
          <label>
            <span>Nome do grupo</span>
            <input data-field="label" type="text" value="${escapeHtml(alias.label)}" placeholder="Google" />
          </label>
          <label>
            <span>Cor</span>
            <select data-field="color">
              ${colorOptions(alias.color)}
            </select>
          </label>
        </article>
      `
    )
    .join("");

  container.querySelectorAll<HTMLButtonElement>("[data-remove-alias]").forEach(button => {
    button.addEventListener("click", () => {
      const aliasId = button.dataset.removeAlias;
      if (!aliasId) return;
      state.domainAliases = state.domainAliases.filter(alias => alias.id !== aliasId);
      render();
    });
  });
}

function renderRuleEditor(): void {
  const container = document.querySelector<HTMLDivElement>("#rules");
  if (!container) return;

  container.innerHTML = state.customRules
    .map(
      (rule, index) => `
        <article class="rule-card" data-rule-id="${rule.id}">
          <header>
            <div>
              <strong>Regra ${index + 1}</strong>
              <small>Combine keywords para forçar o grupo.</small>
            </div>
            <button type="button" class="ghost" data-remove-rule="${rule.id}">Remover</button>
          </header>
          <label>
            <span>Nome do grupo</span>
            <input data-field="name" type="text" value="${escapeHtml(rule.name)}" placeholder="Ex.: Trabalho" />
          </label>
          <label>
            <span>Cor</span>
            <select data-field="color">
              ${colorOptions(rule.color)}
            </select>
          </label>
          <label>
            <span>Keywords</span>
            <input data-field="keywords" type="text" value="${escapeHtml(rule.keywords.join(", "))}" placeholder="gmail, docs, jira" />
          </label>
        </article>
      `
    )
    .join("");

  container.querySelectorAll<HTMLButtonElement>("[data-remove-rule]").forEach(button => {
    button.addEventListener("click", () => {
      const ruleId = button.dataset.removeRule;
      if (!ruleId) return;
      state.customRules = state.customRules.filter(rule => rule.id !== ruleId);
      render();
    });
  });
}

function renderGroupEditor(): void {
  const container = document.querySelector<HTMLDivElement>("#groups");
  if (!container) return;

  if (latestGroups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Nenhum grupo ativo agora. Agrupe algumas abas e elas vão aparecer aqui.
      </div>
    `;
    return;
  }

  container.innerHTML = latestGroups
    .map(
      group => `
        <article class="group-card" data-group-id="${group.id}">
          <header>
            <div>
              <strong>${escapeHtml(group.title || "Sem título")}</strong>
              <small>${group.tabCount} aba(s) · ${group.collapsed ? "recolhido" : "aberto"}</small>
            </div>
            <span class="group-color">${group.color}</span>
          </header>
          <label>
            <span>Novo nome</span>
            <input data-field="group-title" type="text" value="${escapeHtml(group.title || "")}" />
          </label>
          <div class="group-actions">
            <button type="button" class="secondary" data-rename-group="${group.id}">Renomear</button>
            <button type="button" class="secondary" data-toggle-collapse="${group.id}">${group.collapsed ? "Expandir" : "Recolher"}</button>
            <button type="button" class="ghost" data-ungroup-group="${group.id}">Desagrupar</button>
          </div>
        </article>
      `
    )
    .join("");

  container.querySelectorAll<HTMLButtonElement>("[data-rename-group]").forEach(button => {
    button.addEventListener("click", async () => {
      const groupId = Number(button.dataset.renameGroup);
      const card = button.closest<HTMLElement>("[data-group-id]");
      const titleInput = card?.querySelector<HTMLInputElement>('[data-field="group-title"]');
      const nextTitle = titleInput?.value.trim();
      if (!Number.isFinite(groupId) || !nextTitle) return;
      await chrome.tabGroups.update(groupId, { title: nextTitle });
      latestGroups = await loadGroupSnapshot();
      render();
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-toggle-collapse]").forEach(button => {
    button.addEventListener("click", async () => {
      const groupId = Number(button.dataset.toggleCollapse);
      const group = latestGroups.find(item => item.id === groupId);
      if (!Number.isFinite(groupId) || !group) return;
      await chrome.tabGroups.update(groupId, { collapsed: !group.collapsed });
      latestGroups = await loadGroupSnapshot();
      render();
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-ungroup-group]").forEach(button => {
    button.addEventListener("click", async () => {
      const groupId = Number(button.dataset.ungroupGroup);
      if (!Number.isFinite(groupId)) return;
      await ungroupGroup(groupId);
      latestGroups = await loadGroupSnapshot();
      render();
    });
  });
}

function readAliasesFromDom(): DomainAlias[] {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-alias-id]"));
  return cards
    .map(card => {
      const id = card.dataset.aliasId || createRuleId();
      const domain = normalizeDomain(card.querySelector<HTMLInputElement>('[data-field="domain"]')?.value || "");
      const label = card.querySelector<HTMLInputElement>('[data-field="label"]')?.value.trim() || "";
      const color = card.querySelector<HTMLSelectElement>('[data-field="color"]')?.value as TabGroupColor;
      return {
        id,
        domain,
        label,
        color: color || "blue"
      };
    })
    .filter(alias => alias.domain.length > 0 && alias.label.length > 0);
}

function readRulesFromDom(): TabRule[] {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-rule-id]"));
  return cards
    .map(card => {
      const id = card.dataset.ruleId || createRuleId();
      const name = card.querySelector<HTMLInputElement>('[data-field="name"]')?.value.trim() || "Nova regra";
      const color = card.querySelector<HTMLSelectElement>('[data-field="color"]')?.value as TabGroupColor;
      const keywordsValue = card.querySelector<HTMLInputElement>('[data-field="keywords"]')?.value || "";
      return {
        id,
        name,
        color: color || "blue",
        keywords: toRuleKeywords(keywordsValue)
      };
    })
    .filter(rule => rule.name.length > 0 || rule.keywords.length > 0);
}

function bindCheckbox(id: string, onChange: (checked: boolean) => void): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) return;
  input.addEventListener("change", () => onChange(input.checked));
}

function bindSelect(id: string, onChange: (value: string) => void): void {
  const input = document.querySelector<HTMLSelectElement>(`#${id}`);
  if (!input) return;
  input.addEventListener("change", () => onChange(input.value));
}

function bindNumber(id: string, onChange: (value: number) => void): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) return;
  input.addEventListener("change", () => onChange(Number(input.value || 3)));
}

function colorOptions(selected: TabGroupColor): string {
  const colors: TabGroupColor[] = ["grey", "blue", "cyan", "green", "yellow", "orange", "red", "pink", "purple"];
  return colors
    .map(color => `<option value="${color}" ${color === selected ? "selected" : ""}>${color}</option>`)
    .join("");
}

function formatSummary(summary: Awaited<ReturnType<typeof readSession>>["lastSummary"] | null): string {
  if (!summary) return "--";
  return `${summary.movedCount} movidas, ${summary.suggestedCount} sugestões, ${summary.collapsedGroupCount} grupos recolhidos, ${summary.fallbackCount} fallback(s), ${summary.pendingCount} pendentes`;
}

function renderFallbackNotice(summary: Awaited<ReturnType<typeof readSession>>["lastSummary"] | null): string {
  if (!summary || (summary.fallbackCount <= 0 && summary.pendingCount <= 0)) return "";
  return `
    <section class="notice warning">
      <strong>Revisão necessária</strong>
      <p>${summary.fallbackCount} aba(s) caíram em fallback e ${summary.pendingCount} ficaram abaixo do mínimo para agrupar. Ajuste aliases ou regras para reduzir isso.</p>
    </section>
  `;
}

async function loadGroupSnapshot(): Promise<GroupSnapshot[]> {
  const [groups, tabs] = await Promise.all([chrome.tabGroups.query({}), chrome.tabs.query({})]);
  return groups
    .map(group => ({
      collapsed: group.collapsed,
      color: group.color,
      id: group.id,
      tabCount: tabs.filter(tab => tab.groupId === group.id).length,
      title: group.title || "",
      windowId: group.windowId
    }))
    .filter(group => group.tabCount > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function ungroupGroup(groupId: number): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const tabIds = tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.groupId === groupId && tab.id != null)
    .map(tab => tab.id);
  if (tabIds.length > 0) {
    await chrome.tabs.ungroup(tabIds);
  }
}

async function ungroupAllGroups(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const tabIds = tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.groupId != null && tab.groupId !== -1 && tab.id != null)
    .map(tab => tab.id);
  if (tabIds.length > 0) {
    await chrome.tabs.ungroup(tabIds);
  }
}

async function flashButton(button: HTMLButtonElement, label: string): Promise<void> {
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1000);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

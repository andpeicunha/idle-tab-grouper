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
  app.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">Chrome Extension</p>
        <h1>Idle Tab Grouper</h1>
        <p class="lede">Agrupa por alias ou regra, avisa quando cai em fallback e deixa você corrigir grupos na hora.</p>
      </section>

      <section class="panel">
        <label class="toggle-row">
          <span>
            <strong>Ativar extensão</strong>
            <small>Quando desligada, a extensão só observa os dados salvos.</small>
          </span>
          <input id="enabled" type="checkbox" ${state.enabled ? "checked" : ""} />
        </label>

        <label>
          <span>Comportamento</span>
          <select id="behavior">
            <option value="auto" ${state.behavior === "auto" ? "selected" : ""}>Mover automaticamente</option>
            <option value="suggest" ${state.behavior === "suggest" ? "selected" : ""}>Só sugerir</option>
          </select>
        </label>

        <label>
          <span>Estratégia</span>
          <select id="strategy">
            <option value="hybrid" ${state.strategy === "hybrid" ? "selected" : ""}>Híbrido</option>
            <option value="subject" ${state.strategy === "subject" ? "selected" : ""}>Só assunto</option>
            <option value="site" ${state.strategy === "site" ? "selected" : ""}>Só site</option>
          </select>
        </label>

        <label>
          <span>Inatividade mínima</span>
          <div class="inline-field">
            <input id="inactivityMinutes" type="number" min="1" max="60" step="1" value="${state.inactivityMinutes}" />
            <span>min</span>
          </div>
        </label>

        <label>
          <span>Mínimo de abas para agrupar</span>
          <div class="inline-field">
            <input id="minimumTabsToGroup" type="number" min="2" max="50" step="1" value="${state.minimumTabsToGroup}" />
            <span>abas</span>
          </div>
        </label>

        <label class="toggle-row">
          <span>
            <strong>Recolher grupos inativos</strong>
            <small>Quando todos os tabs do grupo estão parados, o grupo vira uma aba compacta.</small>
          </span>
          <input id="collapseInactiveGroups" type="checkbox" ${state.collapseInactiveGroups ? "checked" : ""} />
        </label>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Aliases de sites</h2>
            <p>Ex.: <code>google.com</code> vira <code>Google</code>. Esses nomes viajam com seu Chrome sync.</p>
          </div>
          <button id="addAlias" class="secondary">Adicionar alias</button>
        </div>
        <div id="aliases" class="rules"></div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Regras de assunto</h2>
            <p>Keywords separadas por vírgula. Se baterem com 2 ou mais abas, a extensão agrupa.</p>
          </div>
          <button id="addRule" class="secondary">Adicionar regra</button>
        </div>
        <div id="rules" class="rules"></div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Grupos atuais</h2>
            <p>Você pode renomear, recolher ou desagrupar tudo daqui.</p>
          </div>
          <button id="refreshGroups" class="secondary">Atualizar</button>
        </div>
        <div class="actions actions-wrap">
          <button id="ungroupAll" class="secondary">Desagrupar tudo</button>
        </div>
        <div id="groups" class="groups"></div>
      </section>

      <section class="actions">
        <button id="save" class="primary">Salvar</button>
        <button id="scan" class="secondary">Agrupar agora</button>
      </section>

      <section class="status">
        <div>
          <span class="label">Última execução</span>
          <strong id="lastRunAt">${latestSession?.lastRunAt ? new Date(latestSession.lastRunAt).toLocaleString() : "--"}</strong>
        </div>
        <div>
          <span class="label">Resumo</span>
          <strong id="lastSummary">${formatSummary(latestSession?.lastSummary || null)}</strong>
        </div>
      </section>

      ${renderFallbackNotice(latestSession?.lastSummary || null)}
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

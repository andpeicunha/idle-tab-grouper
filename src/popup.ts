import "./styles/popup.css";

import { DEFAULT_SETTINGS } from "./shared/defaults";
import { readRamSavingsAnalytics, readSession, readSettings } from "./shared/storage";
import { readRamSavings, toPresetView } from "./shared/popup-model";
import type { ExtensionSettings, RamSavingsAnalyticsState } from "./shared/types";

const RAM_NUMBER_FORMAT = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

const app = getAppRoot();

let latestSession: Awaited<ReturnType<typeof readSession>> | null = null;
let latestRamSavings: RamSavingsAnalyticsState | null = null;
let currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };

init().catch(error => {
  console.error("Failed to init popup", error);
  app.innerHTML = `<div class="error">Falha ao carregar a extensão: ${String(error instanceof Error ? error.message : error)}</div>`;
});

async function init(): Promise<void> {
  const [settings, session, ramSavings] = await Promise.all([readSettings(), readSession(), readRamSavingsAnalytics()]);
  currentSettings = settings;
  latestSession = session;
  latestRamSavings = ramSavings;
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
  const summary = latestSession?.lastSummary || null;
  const preset = toPresetView(currentSettings.optimizationPreset, currentSettings.inactivityMinutes);
  const ramSavings = readRamSavings(latestRamSavings);

  app.innerHTML = `
    <main class="shell shell-popup">
      <section class="topbar">
        <div class="brand-pill">
          <span class="brand-mark"></span>
          <span>Idle Tab Grouper</span>
        </div>
        <div class="topbar-status">
          <span class="status-dot"></span>
          <span>${latestSession?.lastRunAt ? "Pronto" : "Novo"}</span>
        </div>
      </section>

      <section class="panel hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Quick actions</p>
          <p class="lede hero-lede">Use o popup para disparar ações rápidas e abra a página completa quando precisar mexer em aliases, regras e ajustes mais profundos.</p>
          <div class="hero-actions hero-actions-stack">
            <button id="scan" class="primary">Agrupar agora</button>
            <button id="openSettings" class="secondary">Abrir configuracoes</button>
          </div>
        </div>
      </section>

      <section class="stats-grid stats-grid-compact">
        <article class="stat-card stat-accent">
          <span class="stat-label">Ultima execucao</span>
          <strong>${latestSession?.lastRunAt ? new Date(latestSession.lastRunAt).toLocaleTimeString() : "--"}</strong>
          <small>${latestSession?.lastRunReason || "Sem atividade recente"}</small>
        </article>
        <article class="stat-card">
          <span class="stat-label">Resumo</span>
          <strong>${summary ? summary.movedCount : 0}</strong>
          <small>${formatSummary(summary)}</small>
        </article>
        <article class="stat-card stat-dark">
          <span class="stat-label">RAM estimada</span>
          <strong>${formatMb(ramSavings.estimatedMb)}</strong>
          <small>${ramSavings.localOnlyLabel}</small>
        </article>
      </section>

      <section class="panel status-band">
        <div>
          <span class="label">Preset base</span>
          <strong>${preset.label}</strong>
        </div>
        <div>
          <span class="label">Leitura rapida</span>
          <strong>${summary ? `${summary.pendingCount} pendentes` : "Sem dados"}</strong>
        </div>
      </section>
    </main>
  `;

  bindActions();
}

function bindActions(): void {
  const scanButton = document.querySelector<HTMLButtonElement>("#scan");
  const openSettingsButton = document.querySelector<HTMLButtonElement>("#openSettings");

  scanButton?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "idle-tab-grouper:scan-now" });
    currentSettings = await readSettings();
    latestSession = await readSession();
    latestRamSavings = await readRamSavingsAnalytics();
    render();
    const refreshedButton = document.querySelector<HTMLButtonElement>("#scan");
    if (refreshedButton) {
      await flashButton(refreshedButton, "Feito");
    }
  });

  openSettingsButton?.addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
    window.close();
  });
}

function formatSummary(summary: Awaited<ReturnType<typeof readSession>>["lastSummary"] | null): string {
  if (!summary) return "Nenhuma execução ainda";
  return `${summary.movedCount} movidas · ${summary.collapsedGroupCount} grupos recolhidos`;
}

function formatMb(value: number): string {
  return `${RAM_NUMBER_FORMAT.format(Math.max(0, Math.round(value)))} MB`;
}

async function flashButton(button: HTMLButtonElement, label: string): Promise<void> {
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1000);
}

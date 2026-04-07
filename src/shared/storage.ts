import { DEFAULT_SETTINGS } from "./defaults";
import type { ExtensionSettings, SessionState } from "./types";

const SETTINGS_KEY = "idle-tab-grouper-settings";
const SESSION_KEY = "idle-tab-grouper-session";

export async function readSettings(): Promise<ExtensionSettings> {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get(SETTINGS_KEY)
  ]);
  return {
    ...DEFAULT_SETTINGS,
    ...(localStored[SETTINGS_KEY] || {}),
    ...(syncStored[SETTINGS_KEY] || {})
  };
}

export async function writeSettings(settings: ExtensionSettings): Promise<void> {
  await Promise.all([
    chrome.storage.sync.set({
      [SETTINGS_KEY]: settings
    }),
    chrome.storage.local.set({
      [SETTINGS_KEY]: settings
    })
  ]);
}

export async function ensureSettings(): Promise<void> {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get(SETTINGS_KEY)
  ]);

  if (!syncStored[SETTINGS_KEY] && localStored[SETTINGS_KEY]) {
    await chrome.storage.sync.set({
      [SETTINGS_KEY]: localStored[SETTINGS_KEY]
    });
  }

  if (!localStored[SETTINGS_KEY] && syncStored[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: syncStored[SETTINGS_KEY]
    });
  }

  if (!syncStored[SETTINGS_KEY] && !localStored[SETTINGS_KEY]) {
    await writeSettings(DEFAULT_SETTINGS);
  }
}

export async function readSession(): Promise<SessionState> {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  return (
    stored[SESSION_KEY] || {
      lastRunAt: null,
      lastRunReason: null,
      lastSummary: null
    }
  );
}

export async function writeSession(state: SessionState): Promise<void> {
  await chrome.storage.session.set({
    [SESSION_KEY]: state
  });
}

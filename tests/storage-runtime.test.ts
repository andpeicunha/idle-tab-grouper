import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultRamSavingsAnalytics,
  ensureRamSavingsAnalytics,
  ensureSettings,
  readRamSavingsAnalytics,
  recordRamSavings,
  writeSettings
} from "../src/shared/storage";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";

type StorageBucket = Record<string, unknown>;

function createStorageArea(bucket: StorageBucket) {
  return {
    async get(key: string) {
      return { [key]: bucket[key] };
    },
    async set(value: Record<string, unknown>) {
      Object.assign(bucket, value);
    }
  };
}

describe("storage runtime boundaries", () => {
  const syncBucket: StorageBucket = {};
  const localBucket: StorageBucket = {};
  const sessionBucket: StorageBucket = {};

  beforeEach(() => {
    for (const key of Object.keys(syncBucket)) delete syncBucket[key];
    for (const key of Object.keys(localBucket)) delete localBucket[key];
    for (const key of Object.keys(sessionBucket)) delete sessionBucket[key];

    vi.stubGlobal("chrome", {
      storage: {
        sync: createStorageArea(syncBucket),
        local: createStorageArea(localBucket),
        session: createStorageArea(sessionBucket)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates default settings for a fresh install path", async () => {
    await ensureSettings();

    expect(syncBucket["idle-tab-grouper-settings"]).toEqual(DEFAULT_SETTINGS);
    expect(localBucket["idle-tab-grouper-settings"]).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps RAM analytics local-only even after settings are synced", async () => {
    await writeSettings(DEFAULT_SETTINGS);
    await ensureRamSavingsAnalytics();
    await recordRamSavings({
      discardedCount: 2,
      estimatedRamSavedMb: 100,
      retentionDays: 7,
      timestamp: Date.parse("2026-04-08T12:00:00Z")
    });

    expect(syncBucket["idle-tab-grouper-ram-savings"]).toBeUndefined();
    expect(localBucket["idle-tab-grouper-ram-savings"]).toEqual({
      version: 1,
      retentionDays: 7,
      days: [{ date: "2026-04-08", discardedCount: 2, estimatedRamSavedMb: 100 }]
    });
  });

  it("reads back local RAM analytics without depending on sync storage", async () => {
    localBucket["idle-tab-grouper-ram-savings"] = createDefaultRamSavingsAnalytics();
    const analytics = await readRamSavingsAnalytics();

    expect(analytics).toEqual({
      version: 1,
      retentionDays: 7,
      days: []
    });
    expect(syncBucket["idle-tab-grouper-ram-savings"]).toBeUndefined();
  });
});

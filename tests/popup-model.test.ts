import { describe, expect, it } from "vitest";

import { readRamSavings, resolvePresetIdFromMinutes, toPresetView } from "../src/shared/popup-model";

describe("popup model helpers", () => {
  it("builds the balanced preset view from saved settings", () => {
    const preset = toPresetView("balanced", 5);

    expect(preset.label).toBe("Equilibrado");
    expect(preset.minutes).toBe(5);
    expect(preset.description).toContain("Padrão");
  });

  it("falls back to a custom preset view for non-standard minutes", () => {
    const preset = toPresetView("custom", 7);

    expect(preset.id).toBe("custom");
    expect(preset.label).toBe("Customizado");
    expect(preset.minutes).toBe(7);
  });

  it("resolves preset ids from known and custom minute values", () => {
    expect(resolvePresetIdFromMinutes(2)).toBe("aggressive");
    expect(resolvePresetIdFromMinutes(5)).toBe("balanced");
    expect(resolvePresetIdFromMinutes(10)).toBe("conservative");
    expect(resolvePresetIdFromMinutes(7)).toBe("custom");
  });

  it("returns a safe empty RAM view when analytics are absent", () => {
    const view = readRamSavings(null);

    expect(view.estimatedMb).toBe(0);
    expect(view.history).toEqual([]);
    expect(view.label).toContain("Nenhuma estimativa");
    expect(view.localOnlyLabel).toContain("local");
  });

  it("builds RAM view data for active and retained history states", () => {
    const view = readRamSavings({
      version: 1,
      retentionDays: 7,
      days: [
        { date: "2026-04-07", discardedCount: 2, estimatedRamSavedMb: 100 },
        { date: "2026-04-08", discardedCount: 3, estimatedRamSavedMb: 150 }
      ]
    });

    expect(view.estimatedMb).toBe(250);
    expect(view.history).toEqual([
      { day: "2026-04-07", estimatedMb: 100, discardedTabs: 2 },
      { day: "2026-04-08", estimatedMb: 150, discardedTabs: 3 }
    ]);
    expect(view.label).toContain("retenção de 7 dia(s)");
  });
});

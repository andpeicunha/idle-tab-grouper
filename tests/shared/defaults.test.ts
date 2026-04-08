import { describe, expect, it } from "vitest";

import {
  DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB,
  DEFAULT_OPTIMIZATION_PRESET,
  DEFAULT_RAM_SAVINGS_ANALYTICS,
  DEFAULT_RAM_SAVINGS_RETENTION_DAYS,
  DEFAULT_SETTINGS,
  OPTIMIZATION_PRESETS
} from "../../src/shared/defaults";

describe("shared defaults", () => {
  it("keeps balanced as the default optimization preset", () => {
    expect(DEFAULT_OPTIMIZATION_PRESET).toBe("balanced");
    expect(DEFAULT_SETTINGS.optimizationPreset).toBe("balanced");
    expect(DEFAULT_SETTINGS.inactivityMinutes).toBe(5);
  });

  it("exposes the expected preset thresholds", () => {
    expect(OPTIMIZATION_PRESETS).toEqual([
      { id: "aggressive", label: "Agressivo", inactivityMinutes: 2 },
      { id: "balanced", label: "Equilibrado", inactivityMinutes: 5 },
      { id: "conservative", label: "Conservador", inactivityMinutes: 10 }
    ]);
  });

  it("sets sane RAM estimation defaults", () => {
    expect(DEFAULT_ESTIMATED_RAM_PER_DISCARD_MB).toBe(50);
    expect(DEFAULT_RAM_SAVINGS_RETENTION_DAYS).toBe(7);
    expect(DEFAULT_RAM_SAVINGS_ANALYTICS).toEqual({
      version: 1,
      retentionDays: 7,
      days: []
    });
  });
});

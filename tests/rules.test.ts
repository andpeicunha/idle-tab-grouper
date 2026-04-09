import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { classifyTab } from "../src/shared/rules";

function createTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    windowId: 1,
    active: false,
    pinned: false,
    discarded: false,
    audible: false,
    title: "Board | BriveUp",
    url: "https://app.clickup.com/t/123?source=briveup",
    ...overrides
  } as chrome.tabs.Tab;
}

describe("tab classification precedence", () => {
  it("prioritizes custom subject rules before site aliases in hybrid mode", () => {
    const decision = classifyTab(
      createTab(),
      {
        ...DEFAULT_SETTINGS,
        strategy: "hybrid",
        customRules: [
          {
            id: "bup",
            name: "Bup",
            color: "blue",
            keywords: ["briveup", "brive"]
          }
        ]
      }
    );

    expect(decision).toEqual({
      title: "Bup",
      color: "blue",
      source: "rule",
      key: "rule:bup"
    });
  });
});

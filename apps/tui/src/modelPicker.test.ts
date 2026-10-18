import { describe, expect, it } from "vitest";
import { rankModelPickerItems } from "@t3tools/client-core";
import { getProviderInstanceModelOptions } from "./providerInstances";
import type { ServerProvider } from "@t3tools/contracts";

describe("modelPicker functionality", () => {
  const antigravityProvider: ServerProvider = {
    instanceId: "antigravity" as any,
    driver: "antigravity" as any,
    displayName: "Antigravity",
    enabled: true,
    installed: true,
    status: "ready",
    availability: "available",
    models: [
      { slug: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", isCustom: false },
      { slug: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium)", isCustom: false },
      { slug: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low)", isCustom: false },
      { slug: "gemini-3.7-flash-high", name: "Gemini 3.7 Flash (High)", isCustom: false, isLegacy: true },
      { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking)", isCustom: false },
      { slug: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking)", isCustom: false },
      { slug: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)", isCustom: false },
    ],
  };

  it("extracts all Antigravity models including Claude and GPT models", () => {
    const options = getProviderInstanceModelOptions([antigravityProvider], "antigravity" as any, []);
    expect(options).toHaveLength(7);
    expect(options.map((o) => o.slug)).toContain("claude-sonnet-4-6");
    expect(options.map((o) => o.slug)).toContain("claude-opus-4-6-thinking");
    expect(options.map((o) => o.slug)).toContain("gpt-oss-120b-medium");
  });

  it("ranks Claude antigravity models when searching for claude", () => {
    const items = [
      {
        instanceId: "antigravity",
        provider: "antigravity",
        driverKind: "antigravity",
        providerDisplayName: "Antigravity",
        slug: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6 (Thinking)",
        isFavorite: false,
      },
      {
        instanceId: "antigravity",
        provider: "antigravity",
        driverKind: "antigravity",
        providerDisplayName: "Antigravity",
        slug: "claude-opus-4-6-thinking",
        name: "Claude Opus 4.6 (Thinking)",
        isFavorite: false,
      },
      {
        instanceId: "antigravity",
        provider: "antigravity",
        driverKind: "antigravity",
        providerDisplayName: "Antigravity",
        slug: "gemini-3.8-flash-high",
        name: "Gemini 3.8 Flash (High)",
        isFavorite: false,
      },
    ];

    const results = rankModelPickerItems(items as any, "claude");
    expect(results).toHaveLength(2);
    expect(results.map((r: any) => r.slug)).toEqual([
      "claude-sonnet-4-6",
      "claude-opus-4-6-thinking",
    ]);
  });

  it("simulates backspace logic correctly for OpenTUI key sequences", () => {
    // OpenTUI backspace sends sequence: "\x7f", name: "backspace"
    const backspaceKey = { name: "backspace", sequence: "\x7f", ctrl: false, meta: false, super: false };

    const isBackspace = (key: typeof backspaceKey) =>
      key.name === "backspace" ||
      key.name === "delete" ||
      key.sequence === "\x7f" ||
      key.sequence === "\b";

    expect(isBackspace(backspaceKey)).toBe(true);

    let query = "claudee";
    if (isBackspace(backspaceKey)) {
      query = query.slice(0, -1);
    }
    expect(query).toBe("claude");
  });

  it("calculates scroll offset bounds correctly across long lists", () => {
    const menuHeight = 8;
    const totalItems = 14;

    const calcScrollTop = (currentIndex: number, currentScrollTop: number) => {
      if (currentIndex < currentScrollTop) {
        return currentIndex;
      }
      if (currentIndex >= currentScrollTop + menuHeight) {
        return currentIndex - menuHeight + 1;
      }
      return currentScrollTop;
    };

    let scrollTop = 0;
    // Step down past height 8 to item index 12 (Claude Opus)
    for (let index = 0; index <= 12; index++) {
      scrollTop = calcScrollTop(index, scrollTop);
    }
    expect(scrollTop).toBe(12 - 8 + 1); // 5
    // Ensure item 12 is in view [5 .. 12]
    expect(12).toBeGreaterThanOrEqual(scrollTop);
    expect(12).toBeLessThan(scrollTop + menuHeight);
  });
});

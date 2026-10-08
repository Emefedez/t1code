import { describe, expect, it } from "vitest";
import { focusOrder, nextFocusStop } from "./focusNavigation";

describe("TUI focus navigation", () => {
  const ordinary = {
    sidebar: true,
    settings: false,
    fullDiff: false,
    terminal: false,
    controls: ["model", "runtime"] as const,
  };
  it("visits only visible regions and each composer control", () => {
    expect(focusOrder(ordinary)).toEqual([
      "projects",
      "threads",
      "timeline",
      "composer",
      "controls:model",
      "controls:runtime",
    ]);
    expect(focusOrder(ordinary)).not.toContain("diff");
    expect(focusOrder(ordinary)).not.toContain("terminal");
  });
  it("wraps both forward and backward", () => {
    const order = focusOrder(ordinary);
    expect(nextFocusStop(order, "controls:runtime", false)).toBe("projects");
    expect(nextFocusStop(order, "projects", true)).toBe("controls:runtime");
    expect(nextFocusStop(order, "composer", true)).toBe("timeline");
  });
  it("skips the hidden sidebar and includes an open terminal", () => {
    expect(focusOrder({ ...ordinary, sidebar: false, terminal: true })).toEqual([
      "timeline",
      "terminal",
      "composer",
      "controls:model",
      "controls:runtime",
    ]);
  });
  it("omits the composer when the full diff replaces it", () => {
    expect(focusOrder({ ...ordinary, fullDiff: true })).toEqual(["projects", "threads", "diff"]);
  });
  it("visits settings fields and recovers when the current field disappears", () => {
    const order = focusOrder({
      ...ordinary,
      settings: true,
      settingsFields: ["field-1", "field-2"],
    });
    expect(order).toEqual(["projects", "settings", "settings:field-1", "settings:field-2"]);
    expect(nextFocusStop(order, "missing", false)).toBe("projects");
    expect(nextFocusStop(order, "missing", true)).toBe("settings:field-2");
  });
});

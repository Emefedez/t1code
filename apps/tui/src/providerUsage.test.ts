import { describe, expect, it } from "vitest";
import { readProviderUsageWindows } from "./providerUsage";

describe("provider account usage", () => {
  it("shows reported session and weekly quota usage", () => {
    expect(
      readProviderUsageWindows({
        windows: [
          { id: "primary", label: "Session", usedPercent: 30, windowDurationMins: 300 },
          { id: "secondary", label: "Weekly", usedPercent: 15, windowDurationMins: 10080 },
        ],
      }),
    ).toEqual([
      { id: "primary", label: "5h", usedPercent: 30 },
      { id: "secondary", label: "7d", usedPercent: 15 },
    ]);
  });
  it("hides missing or unsupported usage rather than fabricating a percentage", () => {
    expect(readProviderUsageWindows(undefined)).toEqual([]);
    expect(
      readProviderUsageWindows({ windows: [], unavailable: { reason: "unsupported" } }),
    ).toEqual([]);
    expect(
      readProviderUsageWindows({ windows: [null, { usedPercent: NaN }, { usedPercent: "50" }] }),
    ).toEqual([]);
  });
  it("supports provider-specific labels and bounded percentages", () => {
    expect(
      readProviderUsageWindows({
        windows: [{ id: "credits", label: "Credits", usedPercent: 120 }],
      }),
    ).toEqual([{ id: "credits", label: "Credits", usedPercent: 100 }]);
  });
});

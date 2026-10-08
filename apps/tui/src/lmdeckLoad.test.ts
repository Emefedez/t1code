import { describe, expect, it } from "vitest";
import { formatLmdeckLoad, parseLmdeckLoad } from "./lmdeckLoad";

describe("lmdeckLoad", () => {
  it("ignores status without a load in flight", () => {
    expect(parseLmdeckLoad({ load: null })).toBeNull();
    expect(parseLmdeckLoad(null)).toBeNull();
  });

  it("formats weight loading with eta", () => {
    const load = parseLmdeckLoad({
      load: { model: "mlx-community/Qwen3.8-27B-4bit", phase: "loading", progress: 0.5, elapsed_secs: 12.4, eta_secs: 11.6, warmup: null },
    });
    expect(load && formatLmdeckLoad(load, 10)).toBe(
      "Loading Qwen3.8-27B-4bit  █████░░░░░ 50% · loading · ~12s left · 12s",
    );
  });

  it("formats warm-up tokens", () => {
    const load = parseLmdeckLoad({
      load: { model: "m", phase: "warming up", progress: 0.95, elapsed_secs: 30, eta_secs: null, warmup: [3, 53] },
    });
    expect(load && formatLmdeckLoad(load)).toContain("warming up 3/53 tokens");
  });
});

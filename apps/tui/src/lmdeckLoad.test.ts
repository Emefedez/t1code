import { describe, expect, it } from "vitest";
import { formatLmdeckLoad, parseLmdeckLoad } from "./lmdeckLoad";

describe("lmdeckLoad", () => {
  it("ignores an idle daemon", () => {
    expect(parseLmdeckLoad({ load: null, running: [{ name: "m", work: null }] })).toBeNull();
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

  it("formats prompt reading after the model is loaded", () => {
    const load = parseLmdeckLoad({
      load: null,
      running: [{ name: "mlx-community/Qwen3.8-27B-4bit", work: { phase: "reading prompt", prompt_done: 2048, prompt_tokens: 8192, tokens_per_sec: 68.2, eta_secs: 90.1, elapsed_secs: 30 } }],
    });
    expect(load && formatLmdeckLoad(load, 8)).toBe(
      "Reading prompt  ██░░░░░░ 2048/8192 · 68 tok/s · ~90s left · Qwen3.8-27B-4bit",
    );
  });

  it("formats generating", () => {
    const load = parseLmdeckLoad({ running: [{ name: "m", work: { phase: "generating", prompt_tokens: 10, elapsed_secs: 42 } }] });
    expect(load && formatLmdeckLoad(load)).toBe("Generating · m · 42s");
  });
});

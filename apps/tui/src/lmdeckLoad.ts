// Model progress from a local lmdeck daemon (GET /lmdeck/status): loading the model
// (`load`), then reading the prompt and generating (`running[].work`). Claude's transport
// has no notion of either, so while a turn waits we ask lmdeck directly.

export type LmdeckLoad =
  | {
      readonly kind: "load";
      readonly model: string;
      readonly phase: string;
      readonly progress: number;
      readonly elapsedSecs: number;
      readonly etaSecs: number | null;
      readonly warmup: readonly [number, number] | null;
    }
  | {
      readonly kind: "prompt";
      readonly model: string;
      readonly done: number;
      readonly total: number;
      readonly tokensPerSec: number | null;
      readonly etaSecs: number | null;
      readonly elapsedSecs: number;
    }
  | {
      readonly kind: "generating" | "waiting";
      readonly model: string;
      readonly promptTokens: number | null;
      readonly elapsedSecs: number;
    };

export const LMDECK_STATUS_URL = `${(process.env.LMDECK_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "")}/lmdeck/status`;

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const numOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function parseLmdeckLoad(status: unknown): LmdeckLoad | null {
  const s = status as {
    load?: Record<string, unknown> | null;
    running?: ReadonlyArray<{ name?: unknown; work?: Record<string, unknown> | null }>;
  } | null;
  const load = s?.load;
  if (load && typeof load.model === "string") {
    const warmup = Array.isArray(load.warmup) && load.warmup.length === 2 ? load.warmup : null;
    return {
      kind: "load",
      model: load.model,
      phase: typeof load.phase === "string" ? load.phase : "loading",
      progress: Math.min(1, Math.max(0, num(load.progress, 0))),
      elapsedSecs: num(load.elapsed_secs, 0),
      etaSecs: numOrNull(load.eta_secs),
      warmup: warmup ? [num(warmup[0], 0), num(warmup[1], 0)] : null,
    };
  }
  const busy = s?.running?.find((r) => r.work && typeof r.name === "string");
  const work = busy?.work;
  if (!busy || !work) return null;
  const model = String(busy.name);
  const elapsedSecs = num(work.elapsed_secs, 0);
  if (work.phase === "reading prompt") {
    return {
      kind: "prompt",
      model,
      done: num(work.prompt_done, 0),
      total: Math.max(1, num(work.prompt_tokens, 1)),
      tokensPerSec: numOrNull(work.tokens_per_sec),
      etaSecs: numOrNull(work.eta_secs),
      elapsedSecs,
    };
  }
  return {
    kind: work.phase === "generating" ? "generating" : "waiting",
    model,
    promptTokens: numOrNull(work.prompt_tokens),
    elapsedSecs,
  };
}

export async function fetchLmdeckLoad(signal?: AbortSignal): Promise<LmdeckLoad | null> {
  try {
    const response = await fetch(LMDECK_STATUS_URL, {
      signal: signal ?? AbortSignal.timeout(1500),
    });
    return response.ok ? parseLmdeckLoad(await response.json()) : null;
  } catch {
    return null;
  }
}

function bar(fraction: number, width: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const shortName = (model: string) => model.split("/").pop() ?? model;
const secs = (s: number) => `${Math.round(s)}s`;

export function formatLmdeckLoad(load: LmdeckLoad, barWidth = 20): string {
  const name = shortName(load.model);
  switch (load.kind) {
    case "load": {
      const detail =
        load.phase === "warming up" && load.warmup
          ? `warming up ${load.warmup[0]}/${load.warmup[1]} tokens`
          : load.phase === "warming up"
            ? "warming up (compiling GPU kernels)"
            : load.phase;
      const eta = load.etaSecs !== null && load.etaSecs > 1 ? ` · ~${secs(load.etaSecs)} left` : "";
      return `Loading ${name}  ${bar(load.progress, barWidth)} ${Math.round(load.progress * 100)}% · ${detail}${eta} · ${secs(load.elapsedSecs)}`;
    }
    case "prompt": {
      const rate = load.tokensPerSec !== null ? ` · ${Math.round(load.tokensPerSec)} tok/s` : "";
      const eta = load.etaSecs !== null && load.etaSecs > 1 ? ` · ~${secs(load.etaSecs)} left` : "";
      return `Reading prompt  ${bar(load.done / load.total, barWidth)} ${load.done}/${load.total}${rate}${eta} · ${name}`;
    }
    case "generating":
      return `Generating · ${name} · ${secs(load.elapsedSecs)}`;
    case "waiting":
      return `Waiting for ${name} · ${secs(load.elapsedSecs)}`;
  }
}

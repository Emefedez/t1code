// Model-load progress from a local lmdeck daemon (GET /lmdeck/status -> `load`).
// Claude's transport has no notion of "the backend is still loading weights",
// so while a turn waits we ask lmdeck directly.

export type LmdeckLoad = {
  readonly model: string;
  readonly phase: string;
  readonly progress: number;
  readonly elapsedSecs: number;
  readonly etaSecs: number | null;
  readonly warmup: readonly [number, number] | null;
};

export const LMDECK_STATUS_URL = `${(process.env.LMDECK_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "")}/lmdeck/status`;

export function parseLmdeckLoad(status: unknown): LmdeckLoad | null {
  const load = (status as { load?: Record<string, unknown> | null } | null)?.load;
  if (!load || typeof load.model !== "string") return null;
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const warmup = Array.isArray(load.warmup) && load.warmup.length === 2 ? load.warmup : null;
  return {
    model: load.model,
    phase: typeof load.phase === "string" ? load.phase : "loading",
    progress: Math.min(1, Math.max(0, num(load.progress, 0))),
    elapsedSecs: num(load.elapsed_secs, 0),
    etaSecs: typeof load.eta_secs === "number" ? load.eta_secs : null,
    warmup: warmup ? [num(warmup[0], 0), num(warmup[1], 0)] : null,
  };
}

export async function fetchLmdeckLoad(signal?: AbortSignal): Promise<LmdeckLoad | null> {
  try {
    const response = await fetch(LMDECK_STATUS_URL, { signal: signal ?? AbortSignal.timeout(1500) });
    return response.ok ? parseLmdeckLoad(await response.json()) : null;
  } catch {
    return null;
  }
}

export function formatLmdeckLoad(load: LmdeckLoad, barWidth = 20): string {
  const filled = Math.round(load.progress * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
  const name = load.model.split("/").pop() ?? load.model;
  const detail =
    load.phase === "warming up" && load.warmup
      ? `warming up ${load.warmup[0]}/${load.warmup[1]} tokens`
      : load.phase === "warming up"
        ? "warming up (compiling GPU kernels)"
        : load.phase;
  const eta = load.etaSecs !== null && load.etaSecs > 1 ? ` · ~${Math.round(load.etaSecs)}s left` : "";
  return `Loading ${name}  ${bar} ${Math.round(load.progress * 100)}% · ${detail}${eta} · ${Math.round(load.elapsedSecs)}s`;
}

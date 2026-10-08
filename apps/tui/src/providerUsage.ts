export type ProviderUsageWindow = { id: string; label: string; usedPercent: number };

/** Use reported account limits only; local providers and missing reports have no meter. */
export function readProviderUsageWindows(value: unknown): readonly ProviderUsageWindow[] {
  if (!value || typeof value !== "object" || !("windows" in value) || !Array.isArray(value.windows))
    return [];
  return value.windows.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const window = entry as Record<string, unknown>;
    if (typeof window.usedPercent !== "number" || !Number.isFinite(window.usedPercent)) return [];
    const minutes = window.windowDurationMins;
    const label =
      typeof minutes === "number" && minutes > 0
        ? minutes % 1440 === 0
          ? `${minutes / 1440}d`
          : minutes % 60 === 0
            ? `${minutes / 60}h`
            : `${minutes}m`
        : typeof window.label === "string"
          ? window.label
          : "Usage";
    return [
      {
        id: typeof window.id === "string" ? window.id : label,
        label,
        usedPercent: Math.max(0, Math.min(100, window.usedPercent)),
      },
    ];
  });
}

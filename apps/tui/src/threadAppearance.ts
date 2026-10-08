import type { TuiPalette, TuiTheme, TuiThemeMode } from "./theme";

export const THREAD_COLOR_OPTIONS = [
  { id: "default", label: "Default", dark: "#a3a3a3", light: "#525252" },
  { id: "red", label: "Red", dark: "#fca5a5", light: "#b91c1c" },
  { id: "orange", label: "Orange", dark: "#fdba74", light: "#c2410c" },
  { id: "yellow", label: "Yellow", dark: "#fde047", light: "#854d0e" },
  { id: "lime", label: "Lime", dark: "#bef264", light: "#4d7c0f" },
  { id: "teal", label: "Teal", dark: "#5eead4", light: "#0f766e" },
  { id: "cyan", label: "Cyan", dark: "#67e8f9", light: "#0e7490" },
  { id: "sky", label: "Sky", dark: "#7dd3fc", light: "#0369a1" },
  { id: "indigo", label: "Indigo", dark: "#a5b4fc", light: "#4338ca" },
  { id: "fuchsia", label: "Fuchsia", dark: "#f0abfc", light: "#a21caf" },
  { id: "rose", label: "Rose", dark: "#fda4af", light: "#be123c" },
  { id: "slate", label: "Slate", dark: "#cbd5e1", light: "#475569" },
  { id: "blue", label: "Blue", dark: "#93c5fd", light: "#1d4ed8" },
  { id: "green", label: "Green", dark: "#86efac", light: "#15803d" },
  { id: "amber", label: "Amber", dark: "#fcd34d", light: "#92400e" },
  { id: "purple", label: "Purple", dark: "#c4b5fd", light: "#6d28d9" },
  { id: "pink", label: "Pink", dark: "#f9a8d4", light: "#be185d" },
] as const;
export const THREAD_TONE_OPTIONS = [
  { id: "subtle", label: "Subtle", amount: 0.16 },
  { id: "medium", label: "Medium", amount: 0.24 },
  { id: "strong", label: "Strong", amount: 0.32 },
] as const;
export type ThreadAppearance = {
  color: (typeof THREAD_COLOR_OPTIONS)[number]["id"];
  tone: (typeof THREAD_TONE_OPTIONS)[number]["id"];
};
export const DEFAULT_THREAD_APPEARANCE: ThreadAppearance = { color: "default", tone: "subtle" };

const AUTOMATIC_THREAD_COLORS: readonly ThreadAppearance["color"][] = [
  "blue",
  "green",
  "purple",
  "orange",
  "cyan",
  "rose",
  "amber",
  "teal",
  "red",
  "indigo",
  "lime",
  "fuchsia",
  "sky",
  "yellow",
  "pink",
  "slate",
];

export function nextThreadAppearance(
  appearances: Readonly<Record<string, ThreadAppearance>>,
): ThreadAppearance {
  const counts = new Map<ThreadAppearance["color"], number>();
  for (const appearance of Object.values(appearances)) {
    counts.set(appearance.color, (counts.get(appearance.color) ?? 0) + 1);
  }
  const color = AUTOMATIC_THREAD_COLORS.toSorted(
    (a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0),
  )[0]!;
  return { color, tone: "subtle" };
}

export function normalizeThreadAppearances(value: unknown): Record<string, ThreadAppearance> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, ThreadAppearance> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object") continue;
    const { color, tone } = entry as ThreadAppearance;
    if (!THREAD_COLOR_OPTIONS.some((option) => option.id === color)) continue;
    result[id] = {
      color,
      tone: THREAD_TONE_OPTIONS.some((option) => option.id === tone) ? tone : "subtle",
    };
  }
  return result;
}

function mixColor(base: string, tint: string, weight: number): string {
  return `#${[1, 3, 5]
    .map((offset) => {
      const start = parseInt(base.slice(offset, offset + 2), 16);
      const end = parseInt(tint.slice(offset, offset + 2), 16);
      return Math.round(start + (end - start) * weight)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

export function threadTextContrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

export function readableThreadText(preferred: string, backgrounds: readonly string[]): string {
  if (backgrounds.every((background) => threadTextContrast(preferred, background) >= 4.5))
    return preferred;
  return ["#ffffff", "#000000"].toSorted(
    (a, b) =>
      Math.min(...backgrounds.map((background) => threadTextContrast(b, background))) -
      Math.min(...backgrounds.map((background) => threadTextContrast(a, background))),
  )[0]!;
}

/** Limit the conversation tint so existing primary and secondary text remain legible. */
export function readableThreadBackground(
  base: string,
  tint: string,
  textColors: readonly string[],
): string {
  for (let step = 20; step >= 0; step--) {
    const weight = step / 20;
    const candidate = mixColor(base, tint, weight);
    if (
      textColors.every(
        (color) =>
          threadTextContrast(color, candidate) >= Math.min(4.5, threadTextContrast(color, base)),
      )
    )
      return candidate;
  }
  return base;
}

export function resolveThreadAppearance(
  appearance: ThreadAppearance | undefined,
  mode: TuiThemeMode,
  sidebar: string,
  pulseTick?: number,
):
  | { accent: string; foreground: string; background: string; activeBackground: string }
  | undefined {
  if (!appearance || appearance.color === "default") return undefined;
  const option = THREAD_COLOR_OPTIONS.find((option) => option.id === appearance.color)!;
  const foreground = option[mode];
  const amount = THREAD_TONE_OPTIONS.find((option) => option.id === appearance.tone)!.amount;
  const tint = (weight: number) => mixColor(sidebar, foreground, weight);
  const pulseAmount =
    pulseTick === undefined
      ? amount
      : amount + (0.16 * (1 + Math.sin((pulseTick * Math.PI) / 4))) / 2;
  const background = tint(pulseAmount);
  const activeBackground = tint(amount + 0.12);
  return {
    accent: foreground,
    foreground: readableThreadText(mode === "dark" ? "#f5f5f5" : "#171717", [
      background,
      activeBackground,
    ]),
    background,
    activeBackground,
  };
}

/** Derive the neutral UI surfaces from the current thread's hue, preserving semantic colors. */
export function resolveThreadTheme(
  theme: TuiTheme,
  appearance: ThreadAppearance | undefined,
): TuiTheme {
  if (!appearance || appearance.color === "default") return theme;
  const option = THREAD_COLOR_OPTIONS.find((option) => option.id === appearance.color)!;
  const accent = option[theme.mode];
  const amount = THREAD_TONE_OPTIONS.find((option) => option.id === appearance.tone)!.amount;
  const palette: TuiPalette = { ...theme.palette };
  const surfaces = {
    canvas: 0.35,
    sidebar: 0.35,
    main: 1,
    surface: 0.55,
    surfaceAlt: 0.65,
    input: 0.25,
    surfaceUser: 0.65,
    footer: 0.35,
    diff: 0.4,
    popup: 0.6,
    controlHover: 0.7,
    controlActive: 0.8,
    controlActiveStrong: 0.9,
    controlInset: 0.35,
    controlInsetHover: 0.55,
    composerPanel: 0.45,
  } as const;
  for (const [key, strength] of Object.entries(surfaces) as [keyof typeof surfaces, number][]) {
    palette[key] = readableThreadBackground(
      theme.palette[key],
      mixColor(theme.palette[key], accent, amount * strength),
      [theme.palette.text, theme.palette.muted],
    );
  }
  palette.surfaceUser = readableThreadBackground(
    palette.main,
    theme.mode === "dark"
      ? mixColor(palette.main, "#000000", 0.3)
      : mixColor(palette.main, accent, 0.12),
    [theme.palette.text],
  );
  const backgrounds = Object.keys(surfaces).map((key) => palette[key as keyof typeof surfaces]);
  palette.text = readableThreadText(theme.palette.text, backgrounds);
  palette.muted = readableThreadText(theme.palette.muted, backgrounds);
  palette.subtle = readableThreadText(theme.palette.subtle, backgrounds);
  for (const key of ["border", "divider", "composerBorderMuted"] as const) {
    palette[key] = mixColor(theme.palette[key], accent, 0.25 + amount * 0.4);
  }
  palette.accent = accent;
  palette.composerBorder = mixColor(theme.palette.input, accent, 0.55);
  palette.composerSend = mixColor(theme.palette.canvas, accent, 0.5);
  palette.composerSendHover = mixColor(theme.palette.canvas, accent, 0.65);
  palette.selection = mixColor(theme.palette.sidebar, accent, 0.4);
  palette.selectionActive = mixColor(theme.palette.sidebar, accent, 0.5);
  return {
    ...theme,
    palette,
    codeBlock: { ...theme.codeBlock, background: palette.input },
    colors: {
      ...theme.colors,
      selectedText: readableThreadText(theme.colors.selectedText, [
        palette.selection,
        palette.selectionActive,
      ]),
      primaryButtonText: readableThreadText(theme.colors.primaryButtonText, [
        palette.composerSend,
        palette.composerSendHover,
      ]),
    },
  };
}

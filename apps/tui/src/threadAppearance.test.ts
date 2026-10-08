import { describe, expect, it } from "vitest";
import {
  THREAD_COLOR_OPTIONS,
  THREAD_TONE_OPTIONS,
  normalizeThreadAppearances,
  nextThreadAppearance,
  type ThreadAppearance,
  resolveThreadAppearance,
  threadTextContrast,
  readableThreadBackground,
  resolveThreadTheme,
} from "./threadAppearance";

import { resolveTuiTheme } from "./theme";

describe("thread appearance", () => {
  it("assigns distinct automatic colors before reusing the least-used color", () => {
    const appearances: Record<string, ThreadAppearance> = {};
    const colors = THREAD_COLOR_OPTIONS.filter((option) => option.id !== "default");
    for (let index = 0; index < colors.length; index++) {
      const next = nextThreadAppearance(appearances);
      expect(Object.values(appearances).some((appearance) => appearance.color === next.color)).toBe(
        false,
      );
      appearances[String(index)] = next;
    }
    expect(nextThreadAppearance(appearances)).toEqual({ color: "blue", tone: "subtle" });
    appearances.extra = { color: "blue", tone: "strong" };
    expect(nextThreadAppearance(appearances).color).toBe("green");
    expect(appearances.extra).toEqual({ color: "blue", tone: "strong" });
  });
  it("validates saved colors and recovers invalid tones", () => {
    expect(
      normalizeThreadAppearances({
        a: { color: "red", tone: "strong" },
        b: { color: "green", tone: "bad" },
        c: { color: "invalid" },
        d: null,
      }),
    ).toEqual({ a: { color: "red", tone: "strong" }, b: { color: "green", tone: "subtle" } });
    expect(normalizeThreadAppearances(null)).toEqual({});
  });
  it("keeps labels readable across all colors, tones and pulse phases", () => {
    for (const mode of ["dark", "light"] as const) {
      const base = mode === "dark" ? "#151515" : "#ffffff";
      for (const color of THREAD_COLOR_OPTIONS.filter((color) => color.id !== "default")) {
        for (const tone of THREAD_TONE_OPTIONS) {
          for (let tick = 0; tick < 8; tick++) {
            const appearance = resolveThreadAppearance(
              { color: color.id, tone: tone.id },
              mode,
              base,
              tick,
            )!;
            expect(
              threadTextContrast(appearance.foreground, appearance.background),
              `${color.id}/${tone.id}/${mode}/${tick}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              threadTextContrast(appearance.foreground, appearance.activeBackground),
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });
  it("keeps conversation text readable while preserving a visible background tint", () => {
    for (const mode of ["dark", "light"] as const) {
      const base = mode === "dark" ? "#171717" : "#ffffff";
      const textColors = mode === "dark" ? ["#f5f5f5", "#a3a3a3"] : ["#171717", "#666666"];
      for (const color of THREAD_COLOR_OPTIONS.filter((color) => color.id !== "default")) {
        const tint = resolveThreadAppearance(
          { color: color.id, tone: "strong" },
          mode,
          base,
        )!.background;
        const background = readableThreadBackground(base, tint, textColors);
        expect(background).not.toBe(base);
        for (const text of textColors)
          expect(threadTextContrast(text, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("uses matching darker chrome and user message boxes while retaining readable text", () => {
    for (const mode of ["dark", "light"] as const) {
      const base = resolveTuiTheme(mode, "default");
      expect(resolveThreadTheme(base, undefined)).toBe(base);
      expect(resolveThreadTheme(base, { color: "default", tone: "strong" })).toBe(base);
      for (const color of THREAD_COLOR_OPTIONS.filter((color) => color.id !== "default")) {
        for (const tone of THREAD_TONE_OPTIONS) {
          const theme = resolveThreadTheme(base, { color: color.id, tone: tone.id });
          for (const key of [
            "sidebar",
            "composerPanel",
            "input",
            "popup",
            "surfaceUser",
          ] as const) {
            expect(theme.palette[key]).not.toBe(base.palette[key]);
            expect(
              threadTextContrast(theme.palette.text, theme.palette[key]),
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              threadTextContrast(theme.palette.muted, theme.palette[key]),
            ).toBeGreaterThanOrEqual(4.5);
          }
          expect(theme.palette.surfaceUser).not.toBe(theme.palette.main);
          expect(threadTextContrast("#ffffff", theme.palette.surfaceUser)).toBeGreaterThan(
            threadTextContrast("#ffffff", theme.palette.main),
          );
          expect(theme.palette.border).not.toBe(base.palette.border);
          expect(theme.palette.warning).toBe(base.palette.warning);
          expect(theme.diffViewer).toBe(base.diffViewer);
          expect(base.palette).toEqual(resolveTuiTheme(mode, "default").palette);
        }
      }
    }
  });
  it("lets the default color use the existing theme", () => {
    expect(
      resolveThreadAppearance({ color: "default", tone: "subtle" }, "dark", "#151515"),
    ).toBeUndefined();
  });
  it("pulses the assigned hue and returns to the same brightness each cycle", () => {
    const appearance = { color: "red", tone: "medium" } as const;
    const light = resolveThreadAppearance(appearance, "dark", "#151515", 2)!;
    const dark = resolveThreadAppearance(appearance, "dark", "#151515", 6)!;
    expect(light.background).not.toBe(dark.background);
    expect(light.accent).toBe(dark.accent);
    expect(resolveThreadAppearance(appearance, "dark", "#151515", 10)).toEqual(light);
    expect(resolveThreadAppearance(appearance, "light", "#ffffff")?.foreground).not.toBe(
      light.foreground,
    );
  });
});

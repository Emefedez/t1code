export type FocusArea =
  | "projects"
  | "threads"
  | "controls"
  | "composer"
  | "timeline"
  | "terminal"
  | "diff"
  | "settings";
export type ComposerControl =
  | "model"
  | "traits"
  | "interaction"
  | "runtime"
  | "thread"
  | "send"
  | "env"
  | "branch";

export function focusOrder(input: {
  sidebar: boolean;
  settings: boolean;
  fullDiff: boolean;
  terminal: boolean;
  controls: readonly ComposerControl[];
  settingsFields?: readonly string[];
}): string[] {
  const sidebar = input.sidebar ? ["projects", ...(input.settings ? [] : ["threads"])] : [];
  if (input.settings)
    return [...sidebar, "settings", ...(input.settingsFields ?? []).map((id) => `settings:${id}`)];
  if (input.fullDiff) return [...sidebar, "diff"];
  return [
    ...sidebar,
    "timeline",
    ...(input.terminal ? ["terminal"] : []),
    "composer",
    ...input.controls.map((control) => `controls:${control}`),
  ];
}

export function nextFocusStop(
  order: readonly string[],
  current: string,
  reverse: boolean,
): string | undefined {
  if (order.length === 0) return undefined;
  const index = order.indexOf(current);
  if (index < 0) return reverse ? order.at(-1) : order[0];
  return order[(index + (reverse ? -1 : 1) + order.length) % order.length];
}

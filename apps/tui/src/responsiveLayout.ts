export const TUI_SIDEBAR_WIDTH = 34;
// Narrow hosts (an editor side panel) shrink the sidebar instead of hiding the thread list.
const TUI_SIDEBAR_MIN_WIDTH = 24;
const SIDEBAR_SHRINK_BELOW_COLUMNS = 120;

export function resolveSidebarWidth(viewportColumns: number): number {
  if (viewportColumns >= SIDEBAR_SHRINK_BELOW_COLUMNS) return TUI_SIDEBAR_WIDTH;
  return Math.max(
    TUI_SIDEBAR_MIN_WIDTH,
    Math.min(TUI_SIDEBAR_WIDTH, Math.round(viewportColumns * 0.3)),
  );
}

const SIDEBAR_TOGGLE_MAX_MAIN_COLUMNS = 56;
const SIDEBAR_FORCE_COLLAPSE_MAX_MAIN_COLUMNS = 44;
const COMPOSER_MODE_LABEL_MIN_MAIN_COLUMNS = 58;
const COMPOSER_MODEL_LABEL_MIN_MAIN_COLUMNS = 62;
// The traits control already truncates its label, so it can stay expanded
// at widths where the rest of the composer footer still fits comfortably.
const COMPOSER_TRAITS_LABEL_MIN_MAIN_COLUMNS = 72;

export type TuiResponsiveLayout = Readonly<{
  showSidebarToggle: boolean;
  sidebarForcedCollapsed: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  showSidebar: boolean;
  showWindowDots: boolean;
  showSidebarAlphaBadge: boolean;
  sidebarTitle: string;
  showHeaderProjectBadge: boolean;
  showComposerModeLabels: boolean;
  showComposerModelLabel: boolean;
  showComposerTraitsLabel: boolean;
  showComposerDividers: boolean;
}>;

export function resolveTuiResponsiveLayout(input: {
  viewportColumns: number;
  sidebarCollapsedPreference: boolean;
}): TuiResponsiveLayout {
  const fullSidebarWidth = resolveSidebarWidth(input.viewportColumns);
  const openSidebarMainPanelColumns = input.viewportColumns - fullSidebarWidth - 1;
  const showSidebarToggle =
    openSidebarMainPanelColumns <= SIDEBAR_TOGGLE_MAX_MAIN_COLUMNS ||
    input.sidebarCollapsedPreference;
  const sidebarForcedCollapsed =
    openSidebarMainPanelColumns <= SIDEBAR_FORCE_COLLAPSE_MAX_MAIN_COLUMNS;
  const sidebarCollapsed =
    sidebarForcedCollapsed || (showSidebarToggle && input.sidebarCollapsedPreference);
  const mainPanelColumns =
    input.viewportColumns - (sidebarCollapsed ? 0 : fullSidebarWidth) - (sidebarCollapsed ? 0 : 1);
  const showSidebar = !sidebarCollapsed;
  const showComposerModeLabels = mainPanelColumns >= COMPOSER_MODE_LABEL_MIN_MAIN_COLUMNS;
  const showComposerModelLabel = mainPanelColumns >= COMPOSER_MODEL_LABEL_MIN_MAIN_COLUMNS;
  const showComposerTraitsLabel = mainPanelColumns >= COMPOSER_TRAITS_LABEL_MIN_MAIN_COLUMNS;

  return {
    showSidebarToggle,
    sidebarForcedCollapsed,
    sidebarCollapsed,
    sidebarWidth: sidebarCollapsed ? 0 : fullSidebarWidth,
    showSidebar,
    // The sidebar header has a fixed width when visible, so the macOS window dots
    // should track sidebar visibility rather than the overall terminal width.
    showWindowDots: showSidebar,
    showSidebarAlphaBadge: showSidebar && fullSidebarWidth >= 30,
    sidebarTitle: showSidebar ? "T1 Code" : "T1",
    showHeaderProjectBadge: input.viewportColumns >= 144,
    showComposerModeLabels,
    showComposerModelLabel,
    showComposerTraitsLabel,
    showComposerDividers:
      showComposerModeLabels || showComposerModelLabel || showComposerTraitsLabel,
  };
}

import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
const repo = "/home/m1-max/Work/t1code-t3-frontend";
const { origin, token } = JSON.parse(
  readFileSync("/home/m1-max/.config/t1code/t3-connection.json", "utf8"),
);
const temporary = mkdtempSync("/tmp/t1-model-selection-");
Object.assign(process.env, {
  T1CODE_T3_ORIGIN: origin,
  T1CODE_T3_TOKEN: token,
  T1CODE_CONFIG_HOME: temporary,
  T1CODE_STATE_HOME: temporary,
});
const { createTestRenderer } = await import(
  repo + "/apps/tui/node_modules/@opentui/core/testing.js"
);
const { createRoot } = await import(repo + "/apps/tui/node_modules/@opentui/react/index.js");
const React = await import(repo + "/apps/tui/node_modules/react/index.js");
const { App } = await import(repo + "/apps/tui/src/ui.tsx");
const setup = await createTestRenderer({ width: 160, height: 48, kittyKeyboard: true });
const root = createRoot(setup.renderer);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const prefs = () => JSON.parse(readFileSync(temporary + "/prefs.json", "utf8"));
try {
  root.render(React.createElement(App, { renderer: setup.renderer }));
  await wait(2000);
  for (const [query, instance, model] of [
    ["claude-opus-5-5", "claudeAgent", "claude-opus-5-5"],
    ["gpt-6-astra", "codex", "gpt-6-astra"],
    ["gpt-6-luna", "codex", "gpt-6-luna"],
  ]) {
    setup.mockInput.pressKey("m", { ctrl: true, shift: true });
    await wait(100);
    await setup.mockInput.typeText(query);
    await wait(100);
    setup.mockInput.pressEnter();
    await wait(400);
    assert.equal(prefs().draftProviderInstanceId, instance);
    assert.equal(prefs().draftModel, model);
    const probe = Bun.spawn(["bun", "scripts/verify-t3-mutations.ts"], {
      cwd: repo,
      stdout: "pipe",
      stderr: "pipe",
    });
    assert.equal(await probe.exited, 0, await new Response(probe.stderr).text());
    await wait(1000);
    assert.equal(prefs().draftProviderInstanceId, instance, "Backend refresh reverted provider");
    assert.equal(prefs().draftModel, model, "Backend refresh reverted model");
  }
  setup.mockInput.pressTab();
  await wait(100);
  assert.equal(
    setup.renderer.currentFocusedRenderable,
    null,
    "Composer must lose actual focus at model control",
  );
  setup.mockInput.pressTab({ shift: true });
  await wait(100);
  assert.equal(setup.renderer.currentFocusedRenderable?.constructor.name, "TextareaRenderable");
  for (let i = 0; i < 9; i++) {
    setup.mockInput.pressTab();
    await wait(100);
  }
  const log = readFileSync(temporary + "/tui.log", "utf8");
  const moved = new Set(
    log
      .split("\n")
      .filter((line) => line.includes("ui.focusMoved"))
      .map((line) => JSON.parse(line.slice(line.indexOf("{"))).to),
  );
  assert(moved.has("controls:model"));
  assert(moved.has("controls:runtime"));
  assert(!moved.has("diff"), "Hidden diff must not receive focus");
  console.log(
    "PASS: model changes survive backend refreshes; Tab and Shift+Tab move actual focus and skip hidden panes",
  );
} finally {
  root.unmount();
  setup.renderer.destroy();
}
process.exit(0);

import { beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "./extension";

const state = vi.hoisted(() => ({
  commands: new Map<string, (...args: any[]) => any>(),
  terminals: [] as any[],
  editor: undefined as any,
  trusted: true,
  folder: { uri: { fsPath: "/workspace", toString: () => "file:///workspace" } },
}));
vi.mock("node:fs/promises", () => ({ access: vi.fn().mockResolvedValue(undefined) }));
vi.mock("vscode", () => ({
  commands: {
    registerCommand: (name: string, callback: (...args: any[]) => any) => {
      state.commands.set(name, callback);
      return { dispose() {} };
    },
  },
  workspace: {
    get isTrusted() {
      return state.trusted;
    },
    getWorkspaceFolder: () => state.folder,
    get workspaceFolders() {
      return [state.folder];
    },
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
  },
  window: {
    get activeTextEditor() {
      return state.editor;
    },
    get terminals() {
      return state.terminals;
    },
    createTerminal: (options: any) => {
      const terminal = {
        name: options.name,
        creationOptions: options,
        show: vi.fn(),
        sendText: vi.fn(),
        processId: Promise.resolve(42),
      };
      state.terminals.push(terminal);
      return terminal;
    },
    onDidCloseTerminal: () => ({ dispose() {} }),
    createStatusBarItem: () => ({ show() {}, dispose() {} }),
    showErrorMessage: vi.fn(),
  },
  Uri: { file: (fsPath: string) => ({ fsPath }) },
  ThemeIcon: class {
    constructor(readonly id: string) {}
  },
  ViewColumn: { Beside: -2 },
  TerminalLocation: { Panel: 1 },
  StatusBarAlignment: { Right: 2 },
}));

beforeEach(() => {
  state.commands.clear();
  state.terminals.length = 0;
  state.editor = undefined;
  state.trusted = true;
  activate({
    subscriptions: [],
    asAbsolutePath: (relative: string) => "/extension/" + relative,
  } as any);
});

describe("VS Code T1 integration", () => {
  it("starts the launcher directly and reuses the workspace terminal", async () => {
    await state.commands.get("t1code.open")!();
    await state.commands.get("t1code.open")!();
    expect(state.terminals).toHaveLength(1);
    expect(state.terminals[0].creationOptions.shellPath).toMatch(/\.local\/bin\/t1$/);
    expect(state.terminals[0].creationOptions.shellArgs).toEqual([]);
    expect(state.terminals[0].creationOptions.cwd).toBe(state.folder.uri);
    expect(state.terminals[0].sendText).not.toHaveBeenCalled();
    expect(state.terminals[0].creationOptions.env.T1CODE_USE_KITTY_KEYBOARD).toBe("0");
  });
  it("does not reuse exited terminals and supports independent new sessions", async () => {
    await state.commands.get("t1code.open")!();
    state.terminals[0].exitStatus = { code: 0 };
    await state.commands.get("t1code.open")!();
    await state.commands.get("t1code.openNew")!();
    expect(state.terminals).toHaveLength(3);
  });
  it("inserts unsaved multiline selection safely without submitting it", async () => {
    state.editor = {
      document: {
        uri: {
          scheme: "file",
          fsPath: "/workspace/file with spaces.ts",
          toString: () => "file:///workspace/file",
        },
        languageId: "typescript",
        getText: () => "const unsaved = `value`;\n// ```\n\u001b[201~touch /tmp/injected",
      },
      selection: {
        isEmpty: false,
        start: { line: 2, character: 0 },
        end: { line: 5, character: 0 },
      },
    };
    await state.commands.get("t1code.addSelection")!();
    const [text, execute] = state.terminals[0].sendText.mock.calls[0];
    expect(execute).toBe(false);
    expect(text).toContain('"/workspace/file with spaces.ts" (lines 3-5)');
    expect(text).toContain("````typescript\nconst unsaved");
    expect(text.split("\u001b[201~").length - 1).toBe(1);
    expect(text.startsWith("\u001b[200~")).toBe(true);
  });
  it("inserts the explorer's chosen file even when another editor is active", async () => {
    const resource = {
      scheme: "file",
      fsPath: "/workspace/other.ts",
      toString: () => "file:///workspace/other.ts",
    };
    await state.commands.get("t1code.addFile")!(resource);
    expect(state.terminals[0].sendText).toHaveBeenCalledWith(
      '\u001b[200~@"/workspace/other.ts" \u001b[201~',
      false,
    );
  });
  it("does not start a process in an untrusted workspace", async () => {
    state.trusted = false;
    await state.commands.get("t1code.open")!();
    expect(state.terminals).toHaveLength(0);
  });
});

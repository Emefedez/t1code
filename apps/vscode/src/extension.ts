import * as vscode from "vscode";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";

const TERMINAL_NAME = "T1 Code";

function editorFolder(uri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
  const resource = uri ?? vscode.window.activeTextEditor?.document.uri;
  return (
    (resource ? vscode.workspace.getWorkspaceFolder(resource) : undefined) ??
    vscode.workspace.workspaceFolders?.[0]
  );
}

export function activate(context: vscode.ExtensionContext): void {
  let opening: Promise<vscode.Terminal | undefined> | undefined;

  async function openTerminal(
    forceNew = false,
    uri?: vscode.Uri,
  ): Promise<vscode.Terminal | undefined> {
    if (!vscode.workspace.isTrusted) return;
    const folder = editorFolder(uri);
    if (!forceNew) {
      const existing = vscode.window.terminals.find((terminal) => {
        if (terminal.name !== TERMINAL_NAME || terminal.exitStatus !== undefined) return false;
        const options = terminal.creationOptions as vscode.TerminalOptions;
        const cwd = typeof options.cwd === "string" ? options.cwd : options.cwd?.fsPath;
        return cwd === (folder?.uri.fsPath ?? os.homedir());
      });
      if (existing) {
        existing.show();
        return existing;
      }
      if (opening) return opening;
    }
    const operation = (async () => {
      const configuration = vscode.workspace.getConfiguration("t1code", folder?.uri);
      const configured = configuration.get<string>("executablePath", "~/.local/bin/t1");
      const executable = configured.startsWith("~/")
        ? path.join(os.homedir(), configured.slice(2))
        : configured;
      try {
        await access(executable, constants.X_OK);
      } catch {
        void vscode.window.showErrorMessage(
          `T1 launcher is unavailable: ${executable}. Set T1 Code: Executable Path to your T3-connected launcher.`,
        );
        return undefined;
      }
      const terminal = vscode.window.createTerminal({
        name: TERMINAL_NAME,
        iconPath: {
          light: vscode.Uri.file(context.asAbsolutePath("images/t1-light.svg")),
          dark: vscode.Uri.file(context.asAbsolutePath("images/t1-dark.svg")),
        },
        cwd: folder?.uri ?? os.homedir(),
        // Start the launcher directly; editor context never goes through a shell.
        shellPath: executable,
        shellArgs: [],
        location:
          configuration.get<string>("terminalLocation", "editor") === "panel"
            ? vscode.TerminalLocation.Panel
            : { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
        env: { T1CODE_CALLER: "vscode", T1CODE_USE_KITTY_KEYBOARD: "0" },
      });
      terminal.show();
      return terminal;
    })();
    if (!forceNew) opening = operation;
    try {
      return await operation;
    } finally {
      if (opening === operation) opening = undefined;
    }
  }

  async function appendPrompt(text: string, uri?: vscode.Uri): Promise<void> {
    const terminal = await openTerminal(false, uri);
    if (!terminal) return;
    await terminal.processId;
    // Bracketed paste inserts multiline context without submitting the prompt.
    const clean = [...text]
      .filter((character) => {
        const code = character.codePointAt(0)!;
        return code === 9 || code === 10 || (code >= 32 && code !== 127);
      })
      .join("");
    terminal.sendText(`\u001b[200~${clean}\u001b[201~`, false);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("t1code.open", () => openTerminal()),
    vscode.commands.registerCommand("t1code.openNew", () => openTerminal(true)),
    vscode.commands.registerCommand("t1code.addFile", async (uri?: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      const resource = uri ?? editor?.document.uri;
      if (!resource || resource.scheme !== "file") return;
      let reference = `@${JSON.stringify(resource.fsPath)}`;
      if (editor?.document.uri.toString() === resource.toString() && !editor.selection.isEmpty) {
        const end = editor.selection.end.line + (editor.selection.end.character === 0 ? 0 : 1);
        reference += ` (lines ${editor.selection.start.line + 1}-${end})`;
      }
      await appendPrompt(reference + " ", resource);
    }),
    vscode.commands.registerCommand("t1code.addSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty || editor.document.uri.scheme !== "file") return;
      const selected = editor.document.getText(editor.selection);
      const end = editor.selection.end.line + (editor.selection.end.character === 0 ? 0 : 1);
      const header = `${JSON.stringify(editor.document.uri.fsPath)} (lines ${editor.selection.start.line + 1}-${end})`;
      const fence = "`".repeat(
        Math.max(3, ...[...selected.matchAll(/`+/g)].map((match) => match[0].length + 1)),
      );
      await appendPrompt(
        `\n${header}\n${fence}${editor.document.languageId}\n${selected}\n${fence}\n`,
        editor.document.uri,
      );
    }),
  );
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  status.text = "T1";
  status.tooltip = "Open T1 Code using your T3 backend";
  status.command = "t1code.open";
  status.show();
  context.subscriptions.push(status);
}

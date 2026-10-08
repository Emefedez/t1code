# T1 Code for VS Code

Opens the T1 terminal UI beside your editor, using the installed T3 backend,
models, threads, and worktrees. T3 runs in the background without its desktop UI.

- **T1 Code: Open or Focus** (`Ctrl+Alt+T`, `Cmd+Alt+T` on macOS): reuse the workspace's T1 terminal.
- **T1 Code: Open New Session**: open another terminal.
- **T1 Code: Add File Reference**: insert the current file path and selected line range.
- **T1 Code: Add Selection to Prompt**: insert selected code, including unsaved edits, with its path and line range.

Commands are also available in the editor toolbar and context menus. Context is
inserted into the composer; you review it and submit it yourself.

`t1code.executablePath` defaults to `~/.local/bin/t1`, the launcher installed by
this checkout. `t1code.terminalLocation` can be `editor` or `panel`. Each terminal
starts in its workspace directory, and model selection remains in the T1 UI.
The current launcher requires the local Linux T3 installation. For remote VS Code
workspaces, install a compatible launcher on the remote host and configure its path.

Build and package from this directory:

```sh
bun run build
bun run package
code --install-extension ../../artifacts/t1code-0.1.2.vsix --force
```

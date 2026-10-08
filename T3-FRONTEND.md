# T1 terminal frontend for the installed T3 backend

`~/.local/bin/t1` and `t1code` run `scripts/t1-t3.py`. The launcher connects to
the installed T3 backend at `http://127.0.0.1:3773`. If it is stopped, the
launcher starts the user service `t3code-backend.service`. The backend runs
without a T3 desktop window and remains available after the terminal closes.
The service starts on demand; it is not enabled to start at login.

The service runs the backend bundled with the installed T3 package using
Electron's Node mode. `scripts/t3-backend.py` locates that package at startup,
so it does not run a separate fork of T3. Inspect it with
`systemctl --user status t3code-backend.service`; logs are available through
`journalctl --user -u t3code-backend.service`.

The terminal client uses T3's RPC endpoint, bearer sessions issued by T3's own
CLI, provider/model catalog, settings, projects, threads, messages, worktrees,
and provider sessions. It does not start T1's forked backend or open a database.
T3 owns its existing `~/.t3/userdata` storage. Changes synchronize with other
T3 clients. T1's previous independent history is preserved separately.

The RPC compatibility layer is in `apps/tui/src/t3Transport.ts`. This checkout
is based on T1 0.0.24 and tested against installed T3 0.0.44. Newer T3 UI
features are not automatically added to the T1 interface, and future protocol
changes may require updating the adapter.

The connection credential is stored with mode 0600 in
`~/.config/t1code/t3-connection.json`. Terminal display preferences are kept in
`~/.config/t1code/t3-frontend`; they are specific to the terminal interface.
Existing T1 sessions need restarting to use the new launcher.

The VS Code extension is installed as `local-t1.t1code`. Press `Ctrl+Alt+T`
or run **T1 Code: Open or Focus** to open T1 beside the editor. Source is in
`apps/vscode`; the installable package is `artifacts/t1code-0.1.2.vsix`.
The editor and explorer context menus can insert file references or selected
code into the composer without submitting it. The T1 monogram appears in
the editor toolbar, terminal tab, and extension listing.

Tab moves forward through visible panes and individual composer controls;
Shift+Tab moves backward. Enter or Space activates a focused control. Hidden
diff/terminal panes and disabled composer actions are skipped. Settings fields
and buttons participate in the cycle, and open dropdowns retain keyboard focus.
Forward Tab still completes an active slash command or file suggestion.

The model dropdown lists available backend providers without the disabled
"Soon" placeholders. Copilot has its own Nerd Font icon and Antigravity has
a distinct triangle icon, also used in the composer. Copilot appears when
the backend advertises an available Copilot instance; the installed backend
currently advertises Antigravity but no standalone Copilot instance.

Rebuild the frontend after changing source:

```sh
cd ~/Work/t1code-t3-frontend
bun run apps/tui/scripts/build-runtime.mjs
```

Verification completed: formatting, lint, all package type checks, compatibility
unit tests, headless conversation rendering, and create/rename/delete plus
cross-client events and Git status against the real installed T3 backend.
No provider turn was started by those checks.

The previous launchers are preserved at
`~/.local/share/t1code/launcher-backup/t1` and `t1code`. To restore them:

```sh
cp -P ~/.local/share/t1code/launcher-backup/t1 ~/.local/bin/t1
cp -P ~/.local/share/t1code/launcher-backup/t1code ~/.local/bin/t1code
```

# t1code

Terminal-first T3 Code fork with an OpenTUI client.

## Install

```bash
bunx @maria_rcks/t1code
```

Requires Bun `>=1.3.9`.

Linux notes:

- T1Code follows XDG defaults on Linux:
  `XDG_CONFIG_HOME/t1code` for prefs, `XDG_STATE_HOME/t1code` for logs and image state, and `XDG_DATA_HOME/t1code` for app data.
- Opening links uses desktop helpers such as `xdg-open` or `gio open`.
- Clipboard image paste works with `wl-paste` on Wayland or `xclip` on X11.

## What You Get

- Native-feeling terminal UI built on OpenTUI
- Bundled server and web client for local use
- Codex-first workflow tuned for terminal usage

## Thread colors and updates

Click **Thread** beside **Full access** to choose its **Sidebar color** or **Sidebar tone**.
These options are also available by right-clicking a thread. The palette offers 16 colors
plus Default; scroll or use the arrow keys to browse the color swatches.
New threads automatically receive the least-used color from a rotating palette.
The draft's color is retained when its first message creates the saved thread.
The selected color tints the sidebar row and conversation background. Surrounding panels,
composer, controls and borders use deeper shades of the same hue, with readable text.
Colors (including red) and tones are saved locally across restarts. Choose **Default** to reset the color.
When another thread receives changes, its sidebar background pulses lighter and darker in its
assigned color until you open it. Threads using the default color pulse blue. Updates keep you
in the current thread.

Provider account usage (for example, **5h 30%** and **7d 15%**) appears beside the
Thread button when reported by the selected provider. Local providers such as LMDeck
that do not report account limits have no usage meter.
LMDeck's model menu shows its configured local models, without the inherited Claude catalog.

## Settled threads

With a T3 backend that supports settlement, choose **Mark settled** or **Reopen thread**
from the Thread button or a thread's context menu. **Ctrl+Shift+S** toggles the current
thread. Settled conversations move into a separate expandable **Settled** section in
that project's sidebar; settling keeps your current conversation open.
T3's backend continues to handle automatic settlement and reopening on new activity.
The Thread menu also lets you turn automatic settlement off or on for that thread.
User messages have a darker box in the thread's hue to distinguish them from replies.

## Source

- Repo: https://github.com/maria-rcks/t1code
- Issues: https://github.com/maria-rcks/t1code/issues

Based on T3 Code by `@t3dotgg` and `@juliusmarminge`.

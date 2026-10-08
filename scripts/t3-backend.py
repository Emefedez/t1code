#!/usr/bin/env python3
"""Run the backend shipped with the installed T3 package, without Electron UI."""
import os
from pathlib import Path
import sys

task_home = Path.home()
packages = list((task_home / ".local/share/omarchy/aur-apps/t3code-bin").glob("*/payload/t3code"))
if not packages:
    sys.exit("Cannot find the installed T3 backend.")
executable = max(packages, key=lambda path: path.stat().st_mtime)
entry = executable.parent / "resources/app.asar/apps/server/dist/bin.mjs"
backend_env = dict(os.environ, ELECTRON_RUN_AS_NODE="1")
os.execve(str(executable), [str(executable), str(entry), "serve", "--host", "127.0.0.1",
                          "--port", "3773", "--base-dir", str(task_home / ".t3"), "--no-browser"], backend_env)

#!/usr/bin/env python3
"""Launch the T1 terminal client against the installed T3 backend."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

TASK_HOME = Path.home()
REPO = Path(__file__).resolve().parent.parent
CONNECTION = TASK_HOME / ".config/t1code/t3-connection.json"
ORIGIN = os.environ.get("T1CODE_T3_ORIGIN", "http://127.0.0.1:3773").rstrip("/")


def ready():
    try:
        with urllib.request.urlopen(ORIGIN + "/.well-known/t3/environment", timeout=1) as response:
            descriptor = json.load(response)
            return descriptor
    except (OSError, urllib.error.URLError):
        return None


if not ready():
    if ORIGIN != "http://127.0.0.1:3773":
        sys.exit("The configured T3 backend is unavailable: " + ORIGIN)
    print("Starting the T3 backend…", file=sys.stderr)
    service = subprocess.run(["systemctl", "--user", "start", "t3code-backend.service"])
    if service.returncode:
        sys.exit("Could not start t3code-backend.service. Check systemctl --user status t3code-backend.service")
    deadline = time.monotonic() + 30
    while not ready() and time.monotonic() < deadline:
        time.sleep(0.25)
    if not ready():
        sys.exit("T3 did not start on " + ORIGIN + ". Check journalctl --user -u t3code-backend.service")

token = os.environ.get("T1CODE_T3_TOKEN")
if not token and CONNECTION.exists():
    saved = json.loads(CONNECTION.read_text())
    if saved.get("origin") == ORIGIN:
        token = saved.get("token")
    if token:
        try:
            request = urllib.request.Request(ORIGIN + "/api/auth/session", headers={"Authorization": "Bearer " + token})
            with urllib.request.urlopen(request, timeout=3) as response:
                if not json.load(response).get("authenticated"):
                    token = None
        except (OSError, urllib.error.URLError):
            token = None

if not token:
    packages = list((TASK_HOME / ".local/share/omarchy/aur-apps/t3code-bin").glob("*/payload/t3code"))
    if not packages:
        sys.exit("Cannot find the installed T3 backend.")
    executable = max(packages, key=lambda path: path.stat().st_mtime)
    entry = executable.parent / "resources/app.asar/apps/server/dist/bin.mjs"
    auth_env = dict(os.environ, ELECTRON_RUN_AS_NODE="1")
    auth = subprocess.run([str(executable), str(entry), "auth", "session", "issue",
                           "--base-dir", str(TASK_HOME / ".t3"), "--label", "T1 terminal frontend", "--token-only"],
                          env=auth_env, text=True, capture_output=True, timeout=30)
    if auth.returncode:
        sys.exit("T3 session creation failed: " + auth.stderr)
    token = auth.stdout.strip()
    CONNECTION.parent.mkdir(parents=True, exist_ok=True)
    temporary = CONNECTION.with_suffix(".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump({"origin": ORIGIN, "token": token}, output)
    temporary.replace(CONNECTION)

launch_env = dict(os.environ, T1CODE_T3_ORIGIN=ORIGIN, T1CODE_T3_TOKEN=token,
                  T1CODE_CONFIG_HOME=str(TASK_HOME / ".config/t1code/t3-frontend"),
                  T1CODE_STATE_HOME=str(TASK_HOME / ".local/state/t1code/t3-frontend"))
# Run the TUI as a child (not exec) so that, once it quits, we can offer to stop
# the backend it was using.
try:
    code = subprocess.call(["bun", str(REPO / "apps/tui/dist/index.mjs"), *sys.argv[1:]], env=launch_env)
except KeyboardInterrupt:
    code = 130


def backend_active():
    return subprocess.run(["systemctl", "--user", "is-active", "--quiet", "t3code-backend.service"]).returncode == 0


def other_clients():
    """Other t1code TUIs still running (they would lose their backend)."""
    out = subprocess.run(["pgrep", "-f", "apps/tui/dist/index.mjs"], capture_output=True, text=True).stdout.split()
    return [pid for pid in out if pid != str(os.getpid())]


if ORIGIN == "http://127.0.0.1:3773" and sys.stdin.isatty() and backend_active():
    others = other_clients()
    note = f" ({len(others)} other t1code window(s) still use it)" if others else ""
    try:
        answer = input(f"Also stop the T3 backend{note}? [y/N] ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        answer = ""
    if answer in ("y", "yes", "s", "si", "sí"):
        subprocess.run(["systemctl", "--user", "stop", "t3code-backend.service"])
        print("T3 backend stopped.")
sys.exit(code)

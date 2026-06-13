#!/bin/sh
# Watchdog agent installer — sets up the agent runner as a service that
# starts on boot and restarts on crash.
#
#   curl -fsSL <watchdog>/api/agents/install.sh | sh -s -- --key wdg_xxx
#   curl -fsSL <watchdog>/api/agents/install.sh | sh -s -- --uninstall
#
# macOS: launchd user LaunchAgent. Linux: systemd unit (user, or system when
# root). Anything else: nohup fallback (does not survive reboot).
set -eu

WATCHDOG_URL="${WATCHDOG_URL:-__WATCHDOG_URL__}"
KEY="${WATCHDOG_AGENT_KEY:-}"
UNINSTALL=0

INSTALL_DIR="$HOME/.watchdog-agent"
LOG_FILE="$INSTALL_DIR/agent.log"
RUNNER="$INSTALL_DIR/agent-runner.js"
ENV_FILE="$INSTALL_DIR/env"
PID_FILE="$INSTALL_DIR/agent.pid"
LAUNCHD_LABEL="dev.watchdog.agent"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist"
SYSTEMD_USER_UNIT="$HOME/.config/systemd/user/watchdog-agent.service"
SYSTEMD_SYSTEM_UNIT="/etc/systemd/system/watchdog-agent.service"

say() { printf '%s\n' "$*"; }
fail() { printf '❌ %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --key) KEY="$2"; shift 2 ;;
    --url) WATCHDOG_URL="$2"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    *) fail "Unknown option: $1 (expected --key, --url, or --uninstall)" ;;
  esac
done

uninstall() {
  say "🧹 Uninstalling Watchdog agent…"
  case "$(uname -s)" in
    Darwin)
      if [ -f "$LAUNCHD_PLIST" ]; then
        launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
        rm -f "$LAUNCHD_PLIST"
        say "   Removed launchd service"
      fi
      ;;
    Linux)
      if [ -f "$SYSTEMD_USER_UNIT" ]; then
        systemctl --user disable --now watchdog-agent 2>/dev/null || true
        rm -f "$SYSTEMD_USER_UNIT"
        systemctl --user daemon-reload 2>/dev/null || true
        say "   Removed systemd user service"
      fi
      if [ -f "$SYSTEMD_SYSTEM_UNIT" ] && [ "$(id -u)" = "0" ]; then
        systemctl disable --now watchdog-agent 2>/dev/null || true
        rm -f "$SYSTEMD_SYSTEM_UNIT"
        systemctl daemon-reload 2>/dev/null || true
        say "   Removed systemd system service"
      fi
      ;;
  esac
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -rf "$INSTALL_DIR"
  say "✅ Uninstalled. You can revoke the agent key on the Watchdog Agents page."
}

if [ "$UNINSTALL" = "1" ]; then
  uninstall
  exit 0
fi

[ -n "$KEY" ] || fail "Missing agent key. Run with: --key wdg_xxx (created on the Watchdog Agents page)"
case "$KEY" in
  wdg_*) ;;
  *) fail "That doesn't look like a Watchdog agent key (expected it to start with wdg_)" ;;
esac

command -v node >/dev/null 2>&1 || fail "Node.js 18+ is required but wasn't found. Install it from https://nodejs.org and re-run this command."
NODE_BIN="$(command -v node)"
NODE_MAJOR="$("$NODE_BIN" -e 'console.log(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18+ is required (found $("$NODE_BIN" --version)). Upgrade at https://nodejs.org and re-run this command."

say "🤖 Installing Watchdog agent"
say "   Watchdog: $WATCHDOG_URL"
say "   Into:     $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"
curl -fsSL "$WATCHDOG_URL/api/agents/runner" -o "$RUNNER" || fail "Couldn't download the agent runner from $WATCHDOG_URL"

umask 077
printf 'WATCHDOG_AGENT_KEY=%s\nWATCHDOG_URL=%s\n' "$KEY" "$WATCHDOG_URL" > "$ENV_FILE"
: > "$LOG_FILE"

start_launchd() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$LAUNCHD_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LAUNCHD_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$RUNNER</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WATCHDOG_AGENT_KEY</key><string>$KEY</string>
    <key>WATCHDOG_URL</key><string>$WATCHDOG_URL</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_FILE</string>
  <key>StandardErrorPath</key><string>$LOG_FILE</string>
</dict>
</plist>
EOF
  chmod 600 "$LAUNCHD_PLIST"
  launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
  launchctl load -w "$LAUNCHD_PLIST"
  SERVICE_DESC="launchd service $LAUNCHD_LABEL"
}

write_systemd_unit() {
  cat > "$1" <<EOF
[Unit]
Description=Watchdog monitoring agent
After=network-online.target

[Service]
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $RUNNER
Restart=always
RestartSec=5
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE

[Install]
WantedBy=$2
EOF
}

start_systemd_root() {
  write_systemd_unit "$SYSTEMD_SYSTEM_UNIT" "multi-user.target"
  systemctl daemon-reload
  systemctl enable --now watchdog-agent
  SERVICE_DESC="systemd service watchdog-agent"
}

# Called inside an `if !` condition (errexit is off there), so every step
# must return explicitly on failure to trigger the nohup fallback.
start_systemd_user() {
  mkdir -p "$HOME/.config/systemd/user" || return 1
  write_systemd_unit "$SYSTEMD_USER_UNIT" "default.target" || return 1
  systemctl --user daemon-reload || return 1
  systemctl --user enable --now watchdog-agent || return 1
  SERVICE_DESC="systemd user service watchdog-agent"
  if command -v loginctl >/dev/null 2>&1; then
    loginctl enable-linger "$USER" 2>/dev/null || true
    if [ "$(loginctl show-user "$USER" --property=Linger --value 2>/dev/null)" != "yes" ]; then
      say "⚠️  Note: the agent stops when you log out. To keep it running, ask an admin to run:"
      say "      sudo loginctl enable-linger $USER"
    fi
  fi
}

start_nohup() {
  nohup "$NODE_BIN" "$RUNNER" --key "$KEY" --url "$WATCHDOG_URL" >> "$LOG_FILE" 2>&1 &
  printf '%s\n' "$!" > "$PID_FILE"
  SERVICE_DESC="background process (PID $(cat "$PID_FILE"))"
  say "⚠️  No launchd/systemd found — started with nohup. The agent will NOT survive a reboot."
}

case "$(uname -s)" in
  Darwin)
    start_launchd
    ;;
  Linux)
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
      if [ "$(id -u)" = "0" ]; then
        start_systemd_root
      elif ! start_systemd_user 2>/dev/null; then
        say "⚠️  Couldn't set up a systemd user service — falling back to nohup."
        start_nohup
      fi
    else
      start_nohup
    fi
    ;;
  *)
    start_nohup
    ;;
esac

say "   Started: $SERVICE_DESC"
printf '⏳ Waiting for the agent to connect'
i=0
while [ $i -lt 20 ]; do
  if grep -q "Connected to Watchdog" "$LOG_FILE" 2>/dev/null; then
    printf '\n'
    say "✅ Agent connected! It now shows Online on your Watchdog Agents page."
    say "   Assign monitors there — the agent picks them up within a minute."
    say "   Logs:      $LOG_FILE"
    say "   Uninstall: curl -fsSL $WATCHDOG_URL/api/agents/install.sh | sh -s -- --uninstall"
    exit 0
  fi
  if grep -q "rejected the agent key" "$LOG_FILE" 2>/dev/null; then
    printf '\n'
    say "❌ Watchdog rejected the agent key — removing the service so it doesn't restart-loop."
    uninstall >/dev/null 2>&1 || true
    fail "Revoke this agent and create a new one on the Agents page, then re-run with the new key."
  fi
  printf '.'
  sleep 1
  i=$((i + 1))
done
printf '\n'
say "⚠️  The agent started but hasn't connected yet. Check the logs:"
say "      tail -f $LOG_FILE"

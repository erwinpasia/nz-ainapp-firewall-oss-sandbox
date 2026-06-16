#!/usr/bin/env bash
# Copyright 2026 Erwin R. Pasia | SU.OSM AI (erwinpasia@gmail.com)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# =============================================================================
# NZ AINAPP Firewall OSS Sandbox Control Script
# Usage:
#   ./nz-ai-firewall-bootstrap.sh start [py|js]
#   ./nz-ai-firewall-bootstrap.sh stop
#   ./nz-ai-firewall-bootstrap.sh restart
#   ./nz-ai-firewall-bootstrap.sh status
#   ./nz-ai-firewall-bootstrap.sh logs
# =============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}→${RESET} $*"; }
success() { echo -e "${GREEN}✔${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✖${RESET} $*" >&2; }
banner()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; echo "$(printf '─%.0s' {1..55})"; }

# ── PM2 wrapper (global or npx fallback) ─────────────────────────────────────
pm2_cmd() {
  if command -v pm2 &>/dev/null; then
    pm2 "$@"
  else
    npx -y pm2 "$@"
  fi
}

# ── Port readiness probe ──────────────────────────────────────────────────────
wait_for_port() {
  local port=$1 name=$2 retries=${3:-30}
  info "Waiting for ${name} on port ${port}..."
  for ((i=1; i<=retries; i++)); do
    if nc -z localhost "$port" &>/dev/null 2>&1; then
      success "${name} is READY (port ${port})."
      return 0
    fi
    sleep 1
  done
  warn "Timeout after ${retries}s — ${name} (port ${port}) may not be healthy."
  return 0
}

# ── Port liveness check (no waiting) ─────────────────────────────────────────
port_up() { nc -z localhost "$1" &>/dev/null 2>&1; }

# =============================================================================
# COMMAND: start
# =============================================================================
cmd_start() {
  local backend="${1:-py}"
  banner "NZ AINAPP Firewall OSS Sandbox  —  START (${backend})"

  # 1. Verify Ollama status and models
  info "Checking Ollama status..."
  if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null; then
    warn "Ollama is not running on port 11434! Please run 'ollama serve' to enable full semantic support."
  else
    success "Ollama is active on port 11434."
    
    # Check embedding model
    if curl -s http://127.0.0.1:11434/api/tags | grep -q "nomic-embed-text"; then
      success "nomic-embed-text model is available for L2 Semantic checks."
      info "Pre-warming nomic-embed-text model in GPU (this may take up to 20s on first load)..."
      curl -s -X POST http://127.0.0.1:11434/api/embed -H "Content-Type: application/json" -d '{"model": "nomic-embed-text", "input": "warmup"}' >/dev/null || true
      success "nomic-embed-text model is pre-warmed."
    else
      warn "nomic-embed-text model was not detected. Run 'ollama pull nomic-embed-text' to enable Layer 2."
    fi

    # Check chat model
    if curl -s http://127.0.0.1:11434/api/tags | grep -q "nemotron-3-nano:4b"; then
      success "nemotron-3-nano:4b model is available for conversation."
      info "Pre-warming nemotron-3-nano:4b model in GPU (this may take up to 20s on first load)..."
      curl -s -X POST http://127.0.0.1:11434/api/generate -H "Content-Type: application/json" -d '{"model": "nemotron-3-nano:4b"}' >/dev/null || true
      success "nemotron-3-nano:4b model is pre-warmed."
    else
      warn "nemotron-3-nano:4b model was not detected. Run 'ollama pull nemotron-3-nano:4b' to enable local chat."
    fi
  fi

  # 2. Seed .env.local if not present
  if [ ! -f .env.local ]; then
    info "Seeding initial .env.local configuration..."
    cp .env.example .env.local
    success ".env.local created."
  else
    success ".env.local exists."
  fi

  # Sync environment to Next.js
  cp .env.local web/.env.local
  success "Sync'd .env.local to web/.env.local."

  # Load env variables for PM2
  export $(grep -v '^#' .env.local | xargs)

  # 3. Spin up PostgreSQL Container
  info "Launching PostgreSQL Container..."
  docker compose up -d
  wait_for_port 5432 "PostgreSQL Database"

  # 4. Prepare / Build selected language backend gateway
  info "Preparing AI Firewall Gateway: ${backend}..."
  case "$backend" in
    py)
      info "Python gateway ready (using python3 main.py)..."
      ;;
    js)
      info "Checking TypeScript gateway dependencies..."
      (cd ai-firewall-js && npm install)
      ;;
    *)
      error "Invalid backend selection: '${backend}'. Use py or js."
      exit 1
      ;;
  esac

  # 5. Clean port 11435 and 3001 if occupied by rogue processes
  for PORT in 11435 3001; do
    local PIDS
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [[ -n "$PIDS" ]]; then
      warn "Killing stale process(es) on port ${PORT}: PID(s) ${PIDS}"
      echo "$PIDS" | xargs -r kill -9
    fi
  done

  # 6. Launch via PM2
  info "Launching services under PM2 control..."
  
  # Next.js web application
  # NODE_OPTIONS: raise undici's socket timeout budget to match the gateway's
  # 120s inference window. --max-http-header-size protects against header bloat.
  NODE_OPTIONS="--max-http-header-size=16384" \
    pm2_cmd start npm --name "nz-ai-firewall-web" --cwd "./web" -- run dev

  # Selected gateway proxy
  case "$backend" in
    py)
      pm2_cmd start python3 --name "nz-ai-firewall-proxy" --cwd "./ai-firewall-py" -- main.py
      ;;
    js)
      pm2_cmd start node --name "nz-ai-firewall-proxy" --cwd "./ai-firewall-js" -- -r ts-node/register src/main.ts
      ;;
  esac

  pm2_cmd save
  success "PM2 processes registered and active."

  wait_for_port 11435 "AI Firewall Gateway Proxy"
  wait_for_port 3001 "Dashboard UI Web Portal"

  cmd_status
}

# =============================================================================
# COMMAND: stop
# =============================================================================
cmd_stop() {
  banner "NZ AINAPP Firewall OSS Sandbox  —  STOP"

  # 1. Stop PM2 processes
  info "Stopping PM2 application processes..."
  if pm2_cmd list 2>/dev/null | grep -qE '(nz-ai-firewall-proxy|nz-ai-firewall-web)'; then
    pm2_cmd stop "nz-ai-firewall-proxy" "nz-ai-firewall-web" &>/dev/null || true
    pm2_cmd delete "nz-ai-firewall-proxy" "nz-ai-firewall-web" &>/dev/null || true
    success "PM2 processes stopped and deleted."
  else
    warn "No registered PM2 processes found."
  fi

  # 2. Release ports
  for PORT in 11435 3001; do
    local PIDS
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [[ -n "$PIDS" ]]; then
      warn "Force releasing port ${PORT}: PID(s) ${PIDS}"
      echo "$PIDS" | xargs -r kill -9
      success "Port ${PORT} freed."
    fi
  done

  # 3. Stop Docker database container
  info "Stopping database containers..."
  docker compose down
  success "Docker services offline."

  banner "All Sandbox services are now OFFLINE."
}

# =============================================================================
# COMMAND: restart
# =============================================================================
cmd_restart() {
  banner "NZ AINAPP Firewall OSS Sandbox  —  RESTART"
  info "Restarting PM2 processes..."
  pm2_cmd restart "nz-ai-firewall-proxy" "nz-ai-firewall-web" --update-env || warn "No active processes to restart."
  cmd_status
}

# =============================================================================
# COMMAND: status
# =============================================================================
cmd_status() {
  banner "NZ AINAPP Firewall OSS Sandbox  —  STATUS"

  echo ""
  echo -e "${BOLD}Infrastructure & Interface Ports${RESET}"
  printf "  %-32s %s\n" "PostgreSQL (port 5432)" "$(port_up 5432 && echo -e "${GREEN}ONLINE${RESET}"  || echo -e "${RED}OFFLINE${RESET}")"
  printf "  %-32s %s\n" "Ollama Engine (port 11434)" "$(port_up 11434 && echo -e "${GREEN}ONLINE${RESET}"  || echo -e "${RED}OFFLINE${RESET}")"
  printf "  %-32s %s\n" "Firewall Proxy Gateway (port 11435)" "$(port_up 11435 && echo -e "${GREEN}ONLINE${RESET}"  || echo -e "${RED}OFFLINE${RESET}")"
  printf "  %-32s %s\n" "Dashboard UI Playground (port 3001)" "$(port_up 3001 && echo -e "${GREEN}ONLINE${RESET}"  || echo -e "${RED}OFFLINE${RESET}")"
  echo ""

  echo -e "${BOLD}PM2 Supervision Process Table${RESET}"
  pm2_cmd status 2>/dev/null || warn "PM2 daemon not running."
  echo ""

  echo -e "${BOLD}Docker Container Services${RESET}"
  docker compose ps 2>/dev/null || warn "Docker Compose not running."
  echo ""
}

# =============================================================================
# COMMAND: logs
# =============================================================================
cmd_logs() {
  banner "NZ AINAPP Firewall OSS Sandbox  —  LOGS (Ctrl+C to exit)"
  pm2_cmd logs --lines 50
}

# =============================================================================
# Entry Point Dispatcher
# =============================================================================
COMMAND="${1:-help}"

case "$COMMAND" in
  start)
    shift
    cmd_start "${1:-py}"
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_restart
    ;;
  status)
    cmd_status
    ;;
  logs)
    cmd_logs
    ;;
  help|--help|-h)
    echo ""
    echo -e "${BOLD}NZ AINAPP Firewall OSS Sandbox Management CLI${RESET}"
    echo ""
    echo "  Usage: ./nz-ai-firewall-bootstrap.sh <command> [argument]"
    echo ""
    echo "  Commands:"
    printf "  %-24s %s\n" "start [py|js]" "Build/prepare and boot services under PM2 and Docker"
    printf "  %-24s %s\n" "stop"                     "Shut down database and all PM2 application proxies"
    printf "  %-24s %s\n" "restart"                  "Gracefully restart registered PM2 services"
    printf "  %-24s %s\n" "status"                   "Check status of ports, PM2 processes, and docker"
    printf "  %-24s %s\n" "logs"                     "Stream logs from the PM2 instances"
    echo ""
    ;;
  *)
    error "Unknown command: '$COMMAND'"
    echo "  Run: ./nz-ai-firewall-bootstrap.sh help"
    exit 1
    ;;
esac

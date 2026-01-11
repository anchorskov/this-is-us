#!/usr/bin/env bash
set -euo pipefail

# Local dev helper: runs Hugo on 1313 and wrangler dev on 8787 with upstream to Hugo.
# Workflow: restart existing listeners on 8787/1313 by default (set KILL_EXISTING=0 to refuse).
# Usage: ./start_local.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUGO_DIR="${ROOT_DIR}"
WORKER_DIR="${ROOT_DIR}/worker"
DEFAULT_PERSIST_DIR="$(cd "${WORKER_DIR}/../scripts" && pwd)/wr-persist"
ALT_PERSIST_DIR="${WORKER_DIR}/.wrangler-persist"
UPSTREAM_HOST="127.0.0.1"
UPSTREAM_PORT="1313"
UPSTREAM="http://${UPSTREAM_HOST}:${UPSTREAM_PORT}"
WRANGLER_PORT=8787

# Keep Wrangler state in a single, stable location to avoid duplicate .wrangler dirs.
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$WORKER_DIR/.config}"

count_d1_sqlite() {
  local base_dir="$1"
  local d1_dir="${base_dir}/v3/d1/miniflare-D1DatabaseObject"
  if [[ ! -d "${d1_dir}" ]]; then
    echo 0
    return 0
  fi
  find "${d1_dir}" -maxdepth 1 -type f -name "*.sqlite" 2>/dev/null | wc -l | tr -d ' '
}

if [[ -n "${PERSIST_DIR:-}" ]]; then
  PERSIST_DIR_SOURCE="env"
  PERSIST_DIR="${PERSIST_DIR}"
else
  PERSIST_DIR_SOURCE="default"
  PERSIST_DIR="${DEFAULT_PERSIST_DIR}"
  if [[ -d "${ALT_PERSIST_DIR}" ]]; then
    default_count="$(count_d1_sqlite "${DEFAULT_PERSIST_DIR}")"
    alt_count="$(count_d1_sqlite "${ALT_PERSIST_DIR}")"
    if [[ "${alt_count}" -gt "${default_count}" ]]; then
      PERSIST_DIR_SOURCE="auto"
      PERSIST_DIR="${ALT_PERSIST_DIR}"
    fi
  fi
fi

WRANGLER_PERSIST_ARGS=(--persist-to "${PERSIST_DIR}")

# Control whether wrangler forwards to Hugo.
# Default: NO upstream (API on 8787, Hugo on 1313). Set USE_UPSTREAM=1 to proxy through wrangler.
USE_UPSTREAM="${USE_UPSTREAM:-0}"
KILL_EXISTING="${KILL_EXISTING:-1}"

print_banner() {
  echo "📍 Repo root: ${ROOT_DIR}"
  echo "🧰 Worker dir: ${WORKER_DIR}"
  echo "💾 Persist dir: ${PERSIST_DIR}"
  if [[ "${PERSIST_DIR_SOURCE}" != "default" ]]; then
    echo "   Persist source: ${PERSIST_DIR_SOURCE}"
  fi
  if [[ "${USE_UPSTREAM}" == "1" ]]; then
    echo "🌉 Upstream: enabled (${UPSTREAM})"
  else
    echo "🌉 Upstream: disabled (Hugo on ${UPSTREAM_PORT}, API on ${WRANGLER_PORT})"
  fi
}

port_pids() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti :"${port}" 2>/dev/null || true
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -lptn "sport = :${port}" 2>/dev/null | awk -F 'pid=' 'NR>1 {print $2}' | awk -F ',' '{print $1}' | tr -d ' ' | sort -u || true
    return 0
  fi
  echo ""
}

port_owner_info() {
  local pid="$1"
  if [[ -z "${pid}" ]]; then
    return
  fi
  if command -v ps >/dev/null 2>&1; then
    ps -p "${pid}" -o pid=,comm=,args= || true
  else
    echo "pid=${pid}"
  fi
}

assert_port_free_or_kill() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(port_pids "${port}")"
  if [[ -n "${pids}" ]]; then
    echo "⚠️ ${label} port ${port} already in use."
    for pid in ${pids}; do
      port_owner_info "${pid}"
    done
    if [[ "${KILL_EXISTING}" == "1" ]]; then
      echo "🧨 KILL_EXISTING=1 set; terminating processes on port ${port}..."
      for pid in ${pids}; do
        kill "${pid}" >/dev/null 2>&1 || true
      done
      sleep 1
      pids="$(port_pids "${port}")"
      if [[ -n "${pids}" ]]; then
        echo "❌ Failed to free port ${port}. Aborting."
        exit 1
      fi
      return 0
    fi
    echo "❌ Port ${port} is busy. Set KILL_EXISTING=1 to terminate listeners."
    exit 1
  fi
}

check_d1_populated() {
  local db_name="$1"
  local label="$2"
  local min_tables="$3"
  local required_table="$4"
  local min_rows="$5"

  echo "🔎 Checking ${label} (${db_name}) D1 state..."
  local table_count
  table_count=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute "${db_name}" --local "${WRANGLER_PERSIST_ARGS[@]}" --json --command \
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table';" | jq -r '.[0].results[0].count // 0')
  if [[ "${table_count}" -lt "${min_tables}" ]]; then
    echo "❌ ${label} has only ${table_count} tables; expected at least ${min_tables}."
    exit 1
  fi

  if [[ -n "${required_table}" ]]; then
    local has_table
    has_table=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute "${db_name}" --local "${WRANGLER_PERSIST_ARGS[@]}" --json --command \
      "SELECT name FROM sqlite_master WHERE type='table' AND name='${required_table}' LIMIT 1;" | jq -r '.[0].results[0].name // ""')
    if [[ -z "${has_table}" ]]; then
      echo "❌ ${label} missing required table: ${required_table}"
      exit 1
    fi
  fi

  if [[ "${min_rows}" -ge 0 && -n "${required_table}" ]]; then
    local row_count
    row_count=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute "${db_name}" --local "${WRANGLER_PERSIST_ARGS[@]}" --json --command \
      "SELECT COUNT(*) AS count FROM ${required_table};" | jq -r '.[0].results[0].count // 0')
    if [[ "${row_count}" -lt "${min_rows}" ]]; then
      echo "❌ ${label} ${required_table} has ${row_count} rows; expected at least ${min_rows}."
      exit 1
    fi
  fi
}

# ============================================================================
# Cleanup: Remove any stray .wrangler directories (prevent monorepo drift)
# ============================================================================
if [[ -d "$WORKER_DIR/.wrangler" ]]; then
  echo "🧹 Removing stray .wrangler directory (using XDG_CONFIG_HOME instead)..."
  rm -rf "$WORKER_DIR/.wrangler"
fi

# ============================================================================
# Guardrail: Validate local D1 context before proceeding
# ============================================================================
echo "🔎 Validating local D1 context..."
(
  export PERSIST_DIR="${PERSIST_DIR}"
  cd "$WORKER_DIR"
  ./scripts/guardrails/check-local-d1-context.sh --create
) || exit 1
echo ""

print_banner
echo "🔎 Checking for port collisions..."
assert_port_free_or_kill "${WRANGLER_PORT}" "Wrangler"
assert_port_free_or_kill "${UPSTREAM_PORT}" "Hugo"

check_d1_populated "WY_DB" "WY_DB" 5 "civic_items" 1
check_d1_populated "WY_DB" "WY_DB" 5 "user_preferences" 0
check_d1_populated "EVENTS_DB" "EVENTS_DB" 5 "" -1

echo "🔧 Starting Hugo (npm run hugo:dev -- --port ${UPSTREAM_PORT} --bind ${UPSTREAM_HOST}) (cwd: ${HUGO_DIR})..."
(cd "$HUGO_DIR" && npm run hugo:dev -- --port "${UPSTREAM_PORT}" --bind "${UPSTREAM_HOST}" > /tmp/hugo-dev.log 2>&1) &
HUGO_PID=$!

cleanup() {
  echo "🛑 Stopping Hugo (PID ${HUGO_PID})..."
  kill "${HUGO_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

WRANGLER_DEV_CMD=(./scripts/wr dev --local --port "${WRANGLER_PORT}" --persist-to "${PERSIST_DIR}")
echo "🌐 Starting wrangler dev on ${WRANGLER_PORT} (cwd: ${WORKER_DIR})..."
echo "   Persist directory: ${PERSIST_DIR}"
echo "▶ ${WRANGLER_DEV_CMD[*]}"
(cd "$WORKER_DIR" && \
  if [[ "${USE_UPSTREAM}" == "1" ]]; then
    echo "🌐 Using upstream ${UPSTREAM} (API + assets via wrangler)";
    ./scripts/wr dev --local --port "${WRANGLER_PORT}" --local-upstream "${UPSTREAM}" --persist-to "${PERSIST_DIR}";
  else
    echo "🌐 No upstream (API on ${WRANGLER_PORT}, Hugo on ${UPSTREAM_PORT} directly)";
    ./scripts/wr dev --local --port "${WRANGLER_PORT}" --persist-to "${PERSIST_DIR}";
  fi)

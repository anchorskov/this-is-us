#!/bin/bash
# test-and-verify.sh
# Comprehensive test and verification script for the this-is-us project
# Runs: Jest tests, linting, worker health check, and functions emulator check

set -o pipefail

SCRIPT_NAME="$(basename "$0")"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXIT_CODE=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_section() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
  EXIT_CODE=1
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_skip() {
  echo -e "${YELLOW}⊘ $1${NC}"
}

log_info() {
  echo -e "   $1"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Test 1: Jest tests
test_jest() {
  log_section "1️⃣  RUNNING JEST TESTS"
  
  cd "$REPO_ROOT"
  
  if ! command_exists npm; then
    log_skip "npm not found, skipping Jest tests"
    return
  fi
  
  # Check if jest is configured
  if ! npm run 2>&1 | grep -q "test"; then
    log_skip "npm test not configured, skipping"
    return
  fi
  
  log_info "Command: npm test -- --runInBand"
  if npm test -- --runInBand 2>&1; then
    log_success "Jest tests passed"
  else
    log_error "Jest tests failed"
  fi
}

# Test 2: Linting
test_lint() {
  log_section "2️⃣  RUNNING LINTER"
  
  cd "$REPO_ROOT"
  
  if ! command_exists npm; then
    log_skip "npm not found, skipping lint check"
    return
  fi
  
  # Check if lint is configured
  if ! npm run 2>&1 | grep -q "lint"; then
    log_skip "npm run lint not configured, skipping"
    return
  fi
  
  log_info "Command: npm run lint"
  if npm run lint 2>&1; then
    log_success "Linting passed"
  else
    log_error "Linting failed"
  fi
}

# Test 3: Worker health check
test_worker_health() {
  log_section "3️⃣  CHECKING WORKER HEALTH"
  
  WORKER_URL="http://127.0.0.1:8787"
  HEALTH_ENDPOINT="$WORKER_URL/api/_health"
  
  log_info "Endpoint: $HEALTH_ENDPOINT"
  
  RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_ENDPOINT" 2>&1)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  
  if [[ "$HTTP_CODE" == "200" ]]; then
    if echo "$BODY" | jq -e '.ok == true' >/dev/null 2>&1; then
      log_success "Worker is healthy"
      log_info "Response: $BODY"
    else
      log_error "Worker returned 200 but ok != true"
      log_info "Response: $BODY"
    fi
  elif [[ "$HTTP_CODE" == "000" ]]; then
    log_warning "Worker is not running (connection refused)"
    log_info "Start the worker with: ./start_wrangler.sh"
  else
    log_error "Worker health check failed (HTTP $HTTP_CODE)"
    log_info "Response: $BODY"
  fi
}

# Test 4: Functions emulator check
test_functions_emulator() {
  log_section "4️⃣  CHECKING FUNCTIONS EMULATOR"
  
  EMULATOR_URL="http://127.0.0.1:5001/this-is-us-events/us-central1/listUsers"
  
  log_info "Endpoint: $EMULATOR_URL"
  log_info "Method: POST (dry-run)"
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer fake-test-token-12345" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": true}' \
    "$EMULATOR_URL" 2>&1)
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  
  if [[ "$HTTP_CODE" == "000" ]]; then
    log_warning "Functions emulator is not running (connection refused)"
    log_info "To start the emulator:"
    log_info "  1. Install Firebase tools: npm install -g firebase-tools"
    log_info "  2. Run: firebase emulators:start"
  elif [[ "$HTTP_CODE" == "404" ]]; then
    log_warning "Emulator is running but function endpoint not found (HTTP 404)"
    log_info "This may be normal if the function isn't deployed to emulator"
    log_info "Response: $BODY"
  elif [[ "$HTTP_CODE" == "401" ]] || [[ "$HTTP_CODE" == "403" ]]; then
    log_success "Emulator is running and enforcing auth (HTTP $HTTP_CODE)"
    log_info "This is expected for a dry-run with fake token"
  elif [[ "$HTTP_CODE" == "200" ]]; then
    log_success "Emulator responded successfully (HTTP 200)"
    log_info "Response: $BODY"
  else
    log_error "Emulator returned unexpected HTTP code: $HTTP_CODE"
    log_info "Response: $BODY"
  fi
}

# Main execution
main() {
  echo -e "${BLUE}╭─────────────────────────────────────────────────────╮${NC}"
  echo -e "${BLUE}│  TEST & VERIFY: this-is-us project                  │${NC}"
  echo -e "${BLUE}╰─────────────────────────────────────────────────────╯${NC}"
  echo ""
  log_info "Working directory: $REPO_ROOT"
  echo ""
  
  # Run all tests
  test_jest
  test_lint
  test_worker_health
  test_functions_emulator
  
  # Final summary
  log_section "SUMMARY"
  
  if [[ $EXIT_CODE -eq 0 ]]; then
    log_success "All tests passed!"
  else
    log_error "Some tests failed (exit code: $EXIT_CODE)"
  fi
  
  echo ""
  exit $EXIT_CODE
}

main "$@"

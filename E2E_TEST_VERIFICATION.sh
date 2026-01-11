#!/bin/bash

# E2E Test Verification Checklist
# This script verifies all components are ready for E2E testing

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="${REPO_ROOT}/worker"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check() {
  local component="$1"
  local result="$2"
  
  if [ "$result" = "pass" ]; then
    echo -e "${GREEN}✅${NC} $component"
  elif [ "$result" = "warn" ]; then
    echo -e "${YELLOW}⚠️${NC}  $component"
  else
    echo -e "${RED}❌${NC} $component"
  fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}E2E Test Suite - Verification Checklist${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Check Playwright installation
echo -e "${BLUE}📦 Dependencies${NC}"
if npm ls @playwright/test >/dev/null 2>&1; then
  check "Playwright installed" "pass"
else
  check "Playwright installed" "fail"
  echo "   → Run: npm install --save-dev @playwright/test"
fi
echo ""

# 2. Check test files exist
echo -e "${BLUE}📄 Test Files${NC}"
if [ -f "${REPO_ROOT}/tests/hot-topics-admin-edit.spec.js" ]; then
  check "Test file exists (hot-topics-admin-edit.spec.js)" "pass"
else
  check "Test file exists" "fail"
fi

if [ -f "${REPO_ROOT}/playwright.config.js" ]; then
  check "Config file exists (playwright.config.js)" "pass"
else
  check "Config file exists" "fail"
fi
echo ""

# 3. Check UI updates (test IDs)
echo -e "${BLUE}🏷️  Test IDs in UI${NC}"
if grep -q "data-testid=\"draft-topics-table\"" "${REPO_ROOT}/static/js/admin/hot-topics.js"; then
  check "Table has data-testid" "pass"
else
  check "Table has data-testid" "fail"
fi

if grep -q "data-testid=\"edit-modal\"" "${REPO_ROOT}/static/js/admin/hot-topics.js"; then
  check "Modal has data-testid" "pass"
else
  check "Modal has data-testid" "fail"
fi

if grep -q "data-testid=\"field-priority\"" "${REPO_ROOT}/static/js/admin/hot-topics.js"; then
  check "Form fields have data-testid" "pass"
else
  check "Form fields have data-testid" "fail"
fi
echo ""

# 4. Check npm scripts
echo -e "${BLUE}🔧 NPM Scripts${NC}"
if grep -q '"test:e2e"' "${REPO_ROOT}/package.json"; then
  check "npm run test:e2e script exists" "pass"
else
  check "npm run test:e2e script" "fail"
fi

if grep -q '"test:e2e:ui"' "${REPO_ROOT}/package.json"; then
  check "npm run test:e2e:ui script exists" "pass"
else
  check "npm run test:e2e:ui script" "fail"
fi
echo ""

# 5. Check server availability
echo -e "${BLUE}🌐 Local Servers${NC}"
if curl -s http://localhost:1313 >/dev/null 2>&1; then
  check "Hugo running (localhost:1313)" "pass"
else
  check "Hugo running (localhost:1313)" "fail"
  echo "   → Start with: ./start_local.sh"
fi

if curl -s http://127.0.0.1:8787/api/dev/d1/identity >/dev/null 2>&1; then
  check "Wrangler running (127.0.0.1:8787)" "pass"
else
  check "Wrangler running (127.0.0.1:8787)" "fail"
  echo "   → Start with: ./start_local.sh"
fi
echo ""

# 6. Check database state
echo -e "${BLUE}🗄️  Database State${NC}"
DRAFT_COUNT=$(cd "${WORKER_DIR}" && \
  ./scripts/wr d1 execute WY_DB --local --command \
  "SELECT COUNT(*) as count FROM hot_topics_draft;" 2>/dev/null | \
  jq -r '.[0].results[0].count // 0' || echo "0")

if [ "$DRAFT_COUNT" -gt 0 ]; then
  check "Draft topics exist ($DRAFT_COUNT found)" "pass"
else
  check "Draft topics exist" "warn"
  echo "   → Run ingestion pipeline or insert test data"
fi

# Check migrations applied
MIGRATIONS=$(cd "${WORKER_DIR}" && \
  ./scripts/wr d1 execute WY_DB --local --command \
  "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('hot_topics_draft', 'hot_topic_civic_items_draft');" 2>/dev/null | \
  jq -r '.[0].results[0].count // 0' || echo "0")

if [ "$MIGRATIONS" = "2" ]; then
  check "Migrations applied (draft tables exist)" "pass"
else
  check "Migrations applied" "fail"
  echo "   → Run: cd worker && npm run db:migrate:wy"
fi
echo ""

# 7. Check documentation
echo -e "${BLUE}📚 Documentation${NC}"
if [ -f "${REPO_ROOT}/tests/README.md" ]; then
  check "Tests README exists" "pass"
else
  check "Tests README exists" "fail"
fi

if [ -f "${REPO_ROOT}/E2E_TEST_DOCUMENTATION.md" ]; then
  check "Full E2E documentation exists" "pass"
else
  check "Full E2E documentation" "fail"
fi
echo ""

# 8. Check API routes
echo -e "${BLUE}🛣️  API Routes${NC}"
if grep -q "hot-topics" "${WORKER_DIR}/src/routes/index.mjs" 2>/dev/null; then
  check "Hot topics routes registered in index.mjs" "pass"
else
  check "Hot topics routes registered" "warn"
  echo "   → Check: worker/src/routes/index.mjs"
fi

if [ -f "${WORKER_DIR}/src/routes/adminHotTopics.mjs" ]; then
  check "Admin hot topics API file exists" "pass"
else
  check "Admin hot topics API file" "fail"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

MISSING=0

if ! npm ls @playwright/test >/dev/null 2>&1; then
  ((MISSING++)) || true
fi

if ! curl -s http://localhost:1313 >/dev/null 2>&1; then
  ((MISSING++)) || true
fi

if ! curl -s http://127.0.0.1:8787/api/dev/d1/identity >/dev/null 2>&1; then
  ((MISSING++)) || true
fi

if [ "$DRAFT_COUNT" = "0" ]; then
  ((MISSING++)) || true
fi

if [ "$MISSING" = "0" ]; then
  echo -e "${GREEN}✅ All systems ready!${NC}"
  echo ""
  echo "Ready to run tests:"
  echo "  npm run test:e2e          # Run all tests"
  echo "  npm run test:e2e:ui       # Interactive mode"
  echo "  npm run test:e2e:debug    # Debug mode"
  echo ""
else
  echo -e "${YELLOW}⚠️  $MISSING item(s) need attention before tests can run${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Install dependencies: npm install --save-dev @playwright/test"
  echo "  2. Start servers: ./start_local.sh"
  echo "  3. Ensure test data exists: run ingestion pipeline"
  echo "  4. Run verification again: bash E2E_TEST_VERIFICATION.sh"
  echo ""
fi

echo -e "${BLUE}For detailed help, see:${NC}"
echo "  - tests/README.md"
echo "  - E2E_TEST_DOCUMENTATION.md"
echo "  - tests/run-e2e-tests.sh"

# Playwright E2E Test Suite - Quick Reference Guide

## 📌 At a Glance

**What**: Playwright E2E tests for Admin Hot Topics Review edit workflow  
**Where**: `/home/anchor/projects/this-is-us/tests/`  
**When**: Run locally before deployment, or in CI/CD  
**Why**: Verify complete user workflows work correctly  

---

## ⚡ Quick Commands

```bash
# Install (one time)
npm install --save-dev @playwright/test

# Run all tests
npm run test:e2e

# Interactive UI (watch real-time)
npm run test:e2e:ui

# Step-by-step debug
npm run test:e2e:debug

# View results
npm run test:e2e:report

# Run specific test
npx playwright test tests/hot-topics-admin-edit.spec.js

# Run specific test case
npx playwright test -g "should successfully edit"
```

---

## 🔧 Setup Checklist

Before first run:

```bash
# 1. Start servers
./start_local.sh

# 2. Install Playwright
npm install --save-dev @playwright/test

# 3. Verify everything ready
bash E2E_TEST_VERIFICATION.sh

# 4. Run tests
npm run test:e2e
```

---

## 📝 Test Cases

### 1️⃣ Edit & Publish Topic
**What it does**: Full workflow from draft to published
- Loads draft topics table
- Clicks "Edit" on first topic
- Changes title, summary, priority
- Checks "Invalidate" checkbox
- Clicks "Save & Publish"
- Verifies success notification
- Checks database for changes

**Success looks like**:
```
✓ should successfully edit and publish a draft topic with invalidation
```

### 2️⃣ Validation Errors
**What it does**: Tests form validation
- Opens edit modal
- Clears required title field
- Tries to save
- Verifies error shown (button disabled or message)
- No API call made

**Success looks like**:
```
✓ should display validation errors for invalid input
```

### 3️⃣ Network Error Handling
**What it does**: Tests resilience to network failures
- Opens edit modal
- Simulates network failure
- Tries to save
- Verifies error notification
- Modal stays open with changes

**Success looks like**:
```
✓ should handle network errors gracefully
```

---

## 🎯 Test Data IDs (Copy-Paste Reference)

Use these for selecting elements in tests:

```html
<!-- Table -->
data-testid="draft-topics-table"
data-testid="topic-row"
data-testid="topic-title"
data-testid="btn-view"

<!-- Modal -->
data-testid="edit-modal"
data-testid="field-title"
data-testid="field-summary"
data-testid="field-priority"
data-testid="field-invalidated"
data-testid="btn-cancel"
data-testid="btn-save"
data-testid="btn-save-publish"

<!-- Notifications -->
data-testid="toast-container"
data-testid="toast"
```

---

## 🖥️ Expected Output

### Successful Run
```
Running 3 tests using 1 worker

  Admin Hot Topics Review - Edit Flow
    ✓ should successfully edit and publish a draft topic with invalidation (8.5s)
    ✓ should display validation errors for invalid input (4.2s)
    ✓ should handle network errors gracefully (5.8s)

3 passed (18.5s)
```

### With Failure
```
Running 3 tests using 1 worker

  Admin Hot Topics Review - Edit Flow
    ✓ should successfully edit and publish a draft topic with invalidation (8.5s)
    ✗ should display validation errors for invalid input (4.2s)
    ✓ should handle network errors gracefully (5.8s)

2 passed, 1 failed

❯ Admin Hot Topics Review - Edit Flow › should display validation errors for invalid input
  
  AssertionError: Timed out 5000ms waiting for locator('...')
```

---

## 🐛 If Tests Fail

### Step 1: Check Servers
```bash
# Hugo
curl -s http://localhost:1313 | head -5

# Wrangler
curl -s http://127.0.0.1:8787/api/dev/d1/identity | jq .
```

Both should return content (no "connection refused" errors).

### Step 2: Check Login
Open http://localhost:1313/admin/ in browser. Should see admin dashboard without redirect.

### Step 3: Check Database
```bash
cd worker
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT COUNT(*) FROM hot_topics_draft;"
```

Should return 1 or more.

### Step 4: Debug Test
```bash
npm run test:e2e:debug
```

Opens Playwright Inspector. You can:
- Step through code
- Inspect elements
- View network calls
- Watch browser

### Step 5: View Results
```bash
npm run test:e2e:report
```

Shows HTML report with:
- Screenshots of each step
- Video of test run
- Detailed errors

---

## 📊 Test Metrics

| Metric | Value |
|--------|-------|
| Duration (all 3) | ~18-20 seconds |
| Per test | 4-9 seconds |
| API calls tracked | 2-3 per test |
| Database checks | 1 per test |
| Network retries | Up to 10 with 500ms waits |
| Screenshot on failure | Yes |
| Video on failure | Yes |
| Trace files | Yes |

---

## 🎓 For Beginners

**Never run Playwright before?** Start here:

1. **Install**: `npm install --save-dev @playwright/test`
2. **Run**: `npm run test:e2e`
3. **Watch**: `npm run test:e2e:ui`
4. **Debug**: `npm run test:e2e:debug`

That's it! Tests are self-documenting in the code.

---

## 👥 For Team Members

**Adding new tests?** Follow this pattern:

```javascript
test('should do something specific', async ({ page, context }) => {
  // 1. Navigate & wait for page
  await page.goto('http://localhost:1313/admin/#hot-topics');
  await page.waitForLoadState('networkidle');
  
  // 2. Find element
  const element = page.locator('[data-testid="element-name"]');
  
  // 3. Interact
  await element.click();
  
  // 4. Assert
  await expect(element).toHaveAttribute('data-status', 'active');
});
```

---

## 🚀 For CI/CD

**Running in GitHub Actions, Jenkins, etc?**

```yaml
# GitHub Actions example
- name: Install Playwright
  run: npm install --save-dev @playwright/test
  
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
```

Tests automatically:
- Run with 1 worker (not parallel)
- Retry failing tests
- Run headless (no browser UI)
- Generate JSON report
- Set `CI=true` env var

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **E2E_TEST_DOCUMENTATION.md** | Complete reference (500+ lines) |
| **tests/README.md** | Setup & running guide |
| **tests/hot-topics-admin-edit.spec.js** | Actual test code |
| **playwright.config.js** | Configuration |
| **E2E_TEST_VERIFICATION.sh** | Setup validation |
| **tests/run-e2e-tests.sh** | Interactive starter |

Start with this file, then:
- For setup: `tests/README.md`
- For details: `E2E_TEST_DOCUMENTATION.md`
- For code: `tests/hot-topics-admin-edit.spec.js`

---

## 🎯 Success Criteria

Tests pass when:
- ✅ Draft topics load in table
- ✅ Edit modal opens/closes
- ✅ Form fields update
- ✅ API returns 200 responses
- ✅ Toast notifications appear
- ✅ Database changes persist
- ✅ Public API respects invalidation

---

## 💡 Tips & Tricks

### Running Specific Tests
```bash
# Run only one test case
npx playwright test -g "should successfully edit"

# Run one file only
npx playwright test tests/hot-topics-admin-edit.spec.js

# Run only chromium
npx playwright test --project=chromium
```

### Debugging Selectors
```bash
# If element not found, check selector:
npm run test:e2e:debug

# In Inspector, paste this:
// Find element with test ID
document.querySelector('[data-testid="field-title"]')

// Or use Playwright Inspector to explore DOM
```

### Timing Issues
If tests timeout:
```javascript
// Increase timeouts (in test)
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

// Or configure in playwright.config.js
timeout: 120000  // 2 minutes
expect: { timeout: 10000 }  // 10 seconds
```

### Network Issues
If API calls fail:
```bash
# Check if wrangler is running
curl -s http://127.0.0.1:8787/api/dev/d1/identity | jq .

# Check worker routes
cd worker && npm run dev
```

---

## 🔗 Related Files

- Admin UI: `static/js/admin/hot-topics.js`
- API Routes: `worker/src/routes/adminHotTopics.mjs`
- Config: `playwright.config.js`
- Database: `worker/migrations_wy/0037_hot_topics_draft.sql`

---

## 📞 Support

**Stuck?** Check in this order:

1. **Quick fix**: Run `bash E2E_TEST_VERIFICATION.sh`
2. **Setup guide**: Read `tests/README.md`
3. **Detailed guide**: Read `E2E_TEST_DOCUMENTATION.md`
4. **Code help**: View `tests/hot-topics-admin-edit.spec.js`
5. **Debug**: Run `npm run test:e2e:debug`

---

## 🎉 Ready to Test!

```bash
# One command to run everything
npm run test:e2e

# Or interactive mode
npm run test:e2e:ui

# Or debug
npm run test:e2e:debug
```

That's all you need! 🚀

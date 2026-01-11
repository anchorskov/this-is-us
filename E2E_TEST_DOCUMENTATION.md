# Playwright E2E Test Suite - Admin Hot Topics Review

## Overview

A comprehensive Playwright E2E test suite for testing the Admin Hot Topics Review workflow, including:
- Editing draft topics (title, summary, priority, invalidation)
- Publishing topics with validation
- Verifying UI updates and database state
- Error handling and network resilience

## Files Created/Modified

### Test Files
1. **tests/hot-topics-admin-edit.spec.js** (610 lines)
   - Main test suite with 3 comprehensive test cases
   - Covers edit workflow, validation, and error handling
   - Includes explicit network call tracking

2. **playwright.config.js** (75 lines)
   - Playwright configuration
   - Timeout and retry settings
   - Report generation configuration

### Documentation
1. **tests/README.md**
   - Comprehensive guide for running tests
   - Prerequisites and setup instructions
   - Test IDs reference for selectors
   - Debugging tips

2. **tests/run-e2e-tests.sh**
   - Interactive quick-start script
   - Server availability checks
   - Database state validation
   - Guided test execution

### UI Updates (to enable E2E testing)
1. **static/js/admin/hot-topics.js**
   - Added `data-testid` attributes to all interactive elements
   - Enhanced Priority field (numeric input → select dropdown)
   - Improved field accessibility

2. **package.json**
   - Added `@playwright/test` as dev dependency
   - New npm scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `test:e2e:report`

## Test Scenarios

### Test 1: Successfully Edit and Publish a Draft Topic with Invalidation
**Purpose**: Verify complete edit-to-publish workflow

**Steps**:
1. Navigate to admin hot topics page (`http://localhost:1313/admin/#hot-topics`)
2. Wait for draft topics table to render
3. Click "Edit" on first draft topic
4. Modify fields:
   - Title (add timestamp suffix)
   - Summary (new description)
   - Priority (select "high")
   - Invalidate checkbox (check to hide from public)
5. Click "Save & Publish"
6. Wait for API response from `/api/admin/hot-topics/drafts/:id`

**Assertions**:
- ✅ Edit modal closes after successful save
- ✅ Success toast notification appears
- ✅ Table row updates with new title
- ✅ Topic NOT returned by `GET /api/hot-topics` (public API)
- ✅ Topic exists in `hot_topics` table with:
  - Updated title and summary
  - Correct priority value
  - `invalidated = 1` flag
  - Recent `updated_at` timestamp

**Network Calls Tracked**:
- `POST /api/admin/hot-topics/drafts/:id` - Must return 200
- `GET /api/hot-topics` - Verify topic absent from public

---

### Test 2: Display Validation Errors for Invalid Input
**Purpose**: Ensure form validation works before API calls

**Steps**:
1. Open edit modal for first topic
2. Clear required "Title" field
3. Attempt to save

**Assertions**:
- ✅ Save button disabled OR error message appears
- ✅ Modal remains open
- ✅ No API request made

---

### Test 3: Handle Network Errors Gracefully
**Purpose**: Verify error handling for network failures

**Steps**:
1. Open edit modal
2. Intercept API calls and simulate failure (`route.abort('failed')`)
3. Modify a field and click Save
4. Wait for error toast

**Assertions**:
- ✅ Error toast appears with message
- ✅ Modal remains open with unsaved changes
- ✅ User can close modal or retry

---

## Test Data IDs Reference

All interactive elements have `data-testid` attributes for reliable selection:

### Table Elements
```
[data-testid="draft-topics-table"]   - Main table container
[data-testid="topic-row"]            - Each table row (data-topic-id="id")
[data-testid="topic-title"]          - Title cell
[data-testid="btn-view"]             - View/Expand button
```

### Edit Modal
```
[data-testid="edit-modal"]           - Modal overlay
[data-testid="field-title"]          - Title input
[data-testid="field-summary"]        - Summary textarea
[data-testid="field-priority"]       - Priority select
[data-testid="field-invalidated"]    - Invalidate checkbox
[data-testid="btn-cancel"]           - Cancel button
[data-testid="btn-save"]             - Save Changes button
[data-testid="btn-save-publish"]     - Save & Publish button
```

### Notifications
```
[data-testid="toast-container"]      - Toast container
[data-testid="toast"]                - Individual toast (data-type="success|error|info")
```

---

## Network Call Handling

Tests use **explicit request/response tracking** rather than just `waitForNavigation()`:

```javascript
// Set up response interception
let updateResponseReceived = false;
let updateResponseStatus = null;

page.on('response', async (response) => {
  if (response.url().includes(`/api/admin/hot-topics/drafts/${topicId}`)) {
    updateResponseStatus = response.status();
    updateResponseReceived = true;
  }
});

// Click button that triggers request
await saveButton.click();

// Poll for response with timeout
let retries = 0;
while (!updateResponseReceived && retries < 10) {
  await page.waitForTimeout(500);
  retries++;
}

// Assert response was received and successful
expect(updateResponseReceived).toBe(true);
expect(updateResponseStatus).toBe(200);
```

**Benefits**:
- Detects all network calls, not just navigations
- Captures response status and body
- Provides clear error messages on non-200 responses
- Handles async operations reliably

---

## Running Tests

### Quick Start
```bash
cd /home/anchor/projects/this-is-us
bash tests/run-e2e-tests.sh
```

### Manual Commands

**Install dependencies**:
```bash
npm install --save-dev @playwright/test
```

**Run all tests**:
```bash
npm run test:e2e
```

**Interactive UI mode**:
```bash
npm run test:e2e:ui
```

**Debug mode** (step through):
```bash
npm run test:e2e:debug
```

**View results**:
```bash
npm run test:e2e:report
```

**Run specific test**:
```bash
npx playwright test tests/hot-topics-admin-edit.spec.js
```

**Run specific test case**:
```bash
npx playwright test -g "should successfully edit and publish"
```

---

## Prerequisites Validation

### Servers Running
```bash
curl -s http://127.0.0.1:8787/api/dev/d1/identity | jq '.bindings.WY_DB'
# Expected: { "accessible": true }
```

### User Logged In
- Tests assume Firebase authentication
- User must have admin access (roleLevel >= 50)
- Open `http://localhost:1313/admin/` to verify before running tests

### Database Ready
```bash
cd worker
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT COUNT(*) FROM hot_topics_draft;"
# Expected: >= 1
```

---

## Configuration Files

### playwright.config.js
- Base URL: `http://localhost:1313`
- Timeout: 60s per test
- Expect timeout: 5s per assertion
- Action timeout: 10s per user action
- Reports: HTML + list + JSON
- Screenshots/Videos: On failure

### Test Environment
- Chromium, Firefox, WebKit (all run by default)
- CI mode: Single worker, retries, headless
- Local mode: Parallel workers, no retries

---

## Output & Reporting

### Test Results
```bash
# After running tests
npx playwright show-report
```

Opens HTML report showing:
- Test status (passed/failed/skipped)
- Test duration
- Screenshots of failures
- Videos of full test runs
- Trace files for debugging

### Result Files
```
test-results/
├── hot-topics-admin-edit.spec.js-chromium/  # Test results by browser
├── test-results.json                        # JSON report
├── trace.zip                                # Execution trace
└── playwright-report/
    └── index.html                           # HTML report
```

---

## Debugging Failed Tests

### 1. Check Server Status
```bash
curl -s http://localhost:1313 | head -20  # Hugo
curl -s http://127.0.0.1:8787/api/dev/d1/identity | jq .  # Wrangler
```

### 2. Review Screenshots
```bash
open test-results/hot-topics-admin-edit.spec.js-chromium/*/trace.zip
```

### 3. Run in Debug Mode
```bash
npm run test:e2e:debug
```
- Opens Playwright Inspector
- Step through code, inspect DOM, view network

### 4. Run in Headed Mode
```bash
npx playwright test --headed --workers=1 tests/hot-topics-admin-edit.spec.js
```
- Watch test execute in real browser
- See clicks, form fills, etc.

### 5. Check Database State
```bash
cd worker
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT id, title, invalidated FROM hot_topics_draft LIMIT 1;"
```

### 6. View Browser Console
```bash
# In debug mode (--debug), browser console is available
# In normal mode, check test output for logged errors
```

---

## Maintenance & Updates

### Updating Test Selectors
If UI changes, update `data-testid` attributes:
1. Check what changed in hot-topics.js
2. Update selector in test
3. Verify element is found: `await page.locator('[data-testid="..."]').waitFor()`

### Adding New Tests
Follow this pattern:
```javascript
test('should do something specific', async ({ page, context }) => {
  // Setup
  await page.goto(ADMIN_URL);
  await page.waitForLoadState('networkidle');
  
  // Action
  const element = page.locator('[data-testid="element"]');
  await element.click();
  
  // Assert
  await expect(element).toHaveAttribute('data-status', 'active');
});
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Install Playwright
  run: npm install --save-dev @playwright/test
  
- name: Install browsers
  run: npx playwright install --with-deps chromium
  
- name: Run tests
  run: npm run test:e2e
  env:
    CI: true
```

---

## Known Limitations

1. **Authentication Required**: Tests assume user already logged in
   - Future: Could add login flow if needed

2. **Read-Only Data**: Tests don't clean up changes
   - By design to preserve audit trail
   - Use timestamps in test data for uniqueness

3. **Timing**: Uses explicit waits, not page.goto() navigation waits
   - More reliable than waitForNavigation()
   - Some tests may need adjustment for slow networks

4. **API Assumptions**: Tests assume API endpoints exist and work
   - Should be run after backend integration tests

---

## Support & Troubleshooting

### Common Issues

**Q: Tests timeout waiting for draft-topics-table**
- A: Servers not running, or user not logged in
  - Run `./start_local.sh`
  - Open http://localhost:1313/admin/ to verify login

**Q: "HTTP 404" errors in network calls**
- A: Wrangler not running on 8787, or API routes not registered
  - Check worker/src/routes/index.mjs for route registration
  - Run `npm run test:e2e:debug` to see actual requests

**Q: Toast notifications don't appear**
- A: Modal not closing, or success handler not called
  - Check browser console for JS errors
  - Verify API response was 200
  - Check getApiBase() is returning correct URL

**Q: Database assertions fail**
- A: Topic not being saved to database
  - Check API handler for UPDATE/INSERT logic
  - Run `npx playwright test --debug` to step through
  - Query database manually to verify state

### Getting Help
1. Check test output: `npm run test:e2e` shows detailed errors
2. View report: `npm run test:e2e:report`
3. Debug: `npm run test:e2e:debug`
4. Check logs: `/tmp/hugo-dev.log` and Wrangler console

---

## Summary

This E2E test suite provides comprehensive coverage of the Admin Hot Topics Review system, with:
- ✅ Complete edit-to-publish workflow testing
- ✅ Validation and error handling
- ✅ Network resilience verification
- ✅ Database state assertions
- ✅ Clear documentation and quick-start guide
- ✅ Production-ready configuration

Ready to run!

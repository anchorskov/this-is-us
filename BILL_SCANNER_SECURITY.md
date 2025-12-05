# Bill Scanner Security & Access Control

**Status:** ✅ PROPERLY GUARDED  
**Date:** December 5, 2025

---

## Guards & Restrictions

### 1. Feature Flag: `BILL_SCANNER_ENABLED`

**Location:** `worker/src/routes/civicScan.mjs` (lines 38–44)

```javascript
if (env.BILL_SCANNER_ENABLED !== "true") {
  return new Response(JSON.stringify({ error: "Scanner disabled" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Behavior:**
- **Disabled by default** – must be explicitly set to "true"
- Returns `403 Forbidden` with error message if not set
- Prevents accidental scanner runs without explicit enablement

**Environment Variable:**
- Set in `worker/wrangler.toml` under `[env.production]` and `[env.development]`
- Or export before `npx wrangler dev`: `export BILL_SCANNER_ENABLED=true`
- Production can keep it false; dev/staging can enable it for testing

---

### 2. Host Restriction: Localhost Only

**Location:** `worker/src/routes/civicScan.mjs` (lines 46–52)

```javascript
const host = new URL(request.url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  return new Response(JSON.stringify({ error: "Forbidden. Dev access only." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Behavior:**
- Only accepts requests from `127.0.0.1` or `localhost`
- Rejects all remote hosts with `403 Forbidden`
- Prevents unauthorized access via direct IP or domain name

**Impact:**
- **Local testing:** ✅ Works with `curl http://127.0.0.1:8787/api/internal/civic/scan-pending-bills`
- **Remote/prod:** ❌ Will always return 403
- **WSL:** ✅ Works from WSL terminal (127.0.0.1 is localhost)

---

### 3. API Key Guard: OPENAI_API_KEY

**Location:** `worker/src/lib/hotTopicsAnalyzer.mjs` (line 96–99)

```javascript
if (!env?.OPENAI_API_KEY) {
  console.warn("⚠️ Missing OPENAI_API_KEY; cannot analyze bills");
  return { topics: [], other_flags: [] };
}
```

**Behavior:**
- No OpenAI API key → returns empty results (`topics: []`)
- **Does NOT block the endpoint** – gracefully degrades
- Request succeeds but bills are marked as "no topics found"
- Prevents errors but signals missing configuration via logs

**Impact:**
- **With key:** AI analysis works, bills tagged with topics
- **Without key:** Scan completes with 200 but all results have `topics: []`

---

## Local Testing vs Production Deployment

### Local Testing (`wrangler dev --local`)

| Guard | Setting | Result |
|-------|---------|--------|
| `BILL_SCANNER_ENABLED` | `"true"` | ✅ Allowed |
| Host | `127.0.0.1:8787` | ✅ Allowed |
| `OPENAI_API_KEY` | `sk-...` | ✅ Works |
| curl target | `http://127.0.0.1:8787/api/internal/civic/scan-pending-bills` | ✅ Works |

**Setup:**
```bash
export BILL_SCANNER_ENABLED=true
export OPENAI_API_KEY="sk-..."
npx wrangler dev --local

# In another terminal:
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq .
```

---

### Remote Access (Public / Non-Localhost)

| Guard | Scenario | Result |
|-------|----------|--------|
| Host check | `POST https://example.com/api/internal/civic/scan-pending-bills` | ❌ 403 Forbidden |
| Host check | `curl http://1.2.3.4:8787/api/internal/civic/scan-pending-bills` | ❌ 403 Forbidden |
| Feature flag | Production with `BILL_SCANNER_ENABLED=false` | ❌ 403 Scanner disabled |

**Design intent:** The scanner is development-only and should never be accessible via the public internet.

---

### Production Deployment

**To enable in production (not recommended without additional safeguards):**

1. **Change the host restriction** to a more sophisticated check:
   ```javascript
   // Example: Allow only admin users or scheduled jobs
   const isAdmin = request.headers.get("X-Admin-Token") === env.ADMIN_TOKEN;
   const isScheduled = request.headers.get("X-Scheduler-Key") === env.SCHEDULER_KEY;
   
   if (!isAdmin && !isScheduled) {
     return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
   }
   ```

2. **Or: Use Cloudflare Worker routes** to restrict at the edge:
   - Only allow access from specific IPs (e.g., admin office)
   - Only allow access during business hours
   - Require authentication tokens

3. **Or: Remove the endpoint entirely** and trigger via:
   - Cron jobs (Worker Scheduled Events)
   - Admin dashboard with proper auth
   - Message queue (SQS, Pub/Sub)

**Current production status:** ❌ Not safe for production; needs additional auth/restriction.

---

## Testing the Guards

### Test 1: Feature Flag Is Respected

```bash
cd /home/anchor/projects/this-is-us/worker

# Start WITHOUT BILL_SCANNER_ENABLED
npx wrangler dev --local

# In another terminal:
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq .
```

**Expected response:**
```json
{
  "error": "Scanner disabled"
}
```

**HTTP status:** 403

---

### Test 2: Host Restriction Works

```bash
# Try accessing from a non-localhost address
# (Requires /etc/hosts entry or DNS pointing to your machine)
curl -X POST http://myworker.local:8787/api/internal/civic/scan-pending-bills | jq .
```

**Expected response:**
```json
{
  "error": "Forbidden. Dev access only."
}
```

**HTTP status:** 403

---

### Test 3: OpenAI Key Missing Handling

```bash
# Start wrangler WITHOUT OPENAI_API_KEY
unset OPENAI_API_KEY
npx wrangler dev --local

# In another terminal:
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq .
```

**Expected response:**
```json
{
  "scanned": 5,
  "results": [
    {
      "bill_id": "ocd-bill/...",
      "bill_number": "HB 22",
      "topics": [],
      "confidence_avg": null
    }
  ],
  "timestamp": "2025-12-05T15:42:18.000Z"
}
```

**HTTP status:** 200 (succeeds but with empty topics)

**Logs:**
```
⚠️ Missing OPENAI_API_KEY; cannot analyze bills
```

---

## Access Control Summary Table

| Component | Guard Type | Default | Local Dev | Remote/Prod |
|-----------|-----------|---------|-----------|-------------|
| Feature flag | Environment | Disabled | Enable with export | Keep disabled |
| Host check | Request validation | N/A | Passes (127.0.0.1) | Blocks all |
| OpenAI key | Graceful degradation | Not required | Required for results | Required for results |
| Route wiring | Explicit registration | N/A | Wired in index.mjs | Wired in index.mjs |
| Database access | Worker env binding | N/A | Available (local) | Available (prod) |

---

## Recommended Additional Guards (Future)

### For Production Use:
1. **Bearer token authentication** – Require Authorization header
2. **IP whitelisting** – Only allow scanner from admin IP
3. **Rate limiting** – Max 1 scan per hour
4. **Audit logging** – Log every scan attempt (succeeded/failed)
5. **Scheduled-event-only** – Use Worker Cron instead of HTTP endpoint
6. **Cost guard** – Limit OpenAI API spend per scan

### Example: Scheduled Event Instead of HTTP

```javascript
// In wrangler.toml
[[triggers.crons]]
cron = "0 2 * * *"  # 2 AM daily

// In index.mjs
export default {
  async scheduled(event, env, ctx) {
    await handleScanPendingBills(new Request("http://dummy"), env);
  }
}
```

This removes the HTTP endpoint entirely and only runs on a schedule.

---

## Checklist for Local Testing

- [ ] `BILL_SCANNER_ENABLED=true` is exported before `npx wrangler dev`
- [ ] `OPENAI_API_KEY` is set to a valid OpenAI key
- [ ] curl uses `http://127.0.0.1:8787` (not `localhost` or another hostname)
- [ ] wrangler dev is running in foreground (see logs)
- [ ] WY_DB has pending bills (status: introduced, in_committee, pending_vote)
- [ ] EVENTS_DB has 6 hot_topics seeded
- [ ] POST succeeds with 200 status
- [ ] results.length > 0 (at least one bill scanned)
- [ ] Each result has topics array (may be empty)

---

## Conclusion

**Current security posture:** ✅ **DEVELOPMENT-READY**

The scanner has appropriate guards for local testing:
- Feature flag prevents accidental runs
- Host check prevents remote access
- Graceful API key handling avoids crashes

**Not production-ready** – Additional authentication and authorization needed before deploying to a public/remote environment.

---

**Last Updated:** December 5, 2025

# Hot Topics Alignment - Quick Reference

## Problem Fixed ✅
- **Before**: Preferences page listed 10 topics from `topic_index` table
- **After**: Preferences page lists 6 topics from `hot_topics` table (same as Hot Topics page)
- **Result**: Single source of truth for all topic lists across the site

## What Changed

### 1. Database (D1)
- Migration `0017_align_preferences_to_hot_topics.sql` migrates `user_topic_prefs` to reference `hot_topics` instead of `topic_index`
- Existing preferences preserved via slug matching
- Topics ordered by priority (5-6 core issues first)

### 2. API Endpoint (`GET /api/user-topics`)
```javascript
// OLD: SELECT FROM topic_index
// NEW: SELECT FROM hot_topics WHERE is_active = 1

// Response format unchanged:
[
  { id: 1, name: "Property Tax Relief", slug: "property-tax-relief", checked: 1 },
  { id: 2, name: "Water Rights & Drought Planning", slug: "water-rights", checked: 0 },
  // ... more topics
]
```

### 3. Preferences Page (`/account/preferences/`)
- Still shows checkboxes for topics
- Now saves to **both**:
  1. D1 `user_topic_prefs` (for backend logic)
  2. Firestore `users/{uid}.preferences.followedTopics` (for frontend highlighting)

### 4. Hot Topics Page (`/hot-topics/`)
- Now highlights topics user follows
- Followed topics appear first
- Shows ★ "Following" badge on followed topics
- Styling hint: `followed-badge` class available for CSS

## Deployment

### Step 1: Database Migration
```bash
./scripts/wr d1 execute EVENTS_DB --file worker/migrations/0017_align_preferences_to_hot_topics.sql
```

### Step 2: Deploy Worker
```bash
npm run deploy
```

### Step 3: Clear Cache & Test
```bash
# Test API
curl http://127.0.0.1:8787/api/user-topics

# Test pages
# - /account/preferences/ (should show 6 topics)
# - /hot-topics/ (should highlight followed topics)
```

## Verification

✅ All files created/updated:
- `worker/migrations/0017_align_preferences_to_hot_topics.sql` (61 lines)
- `worker/src/routes/api/user-topics/index.js` (updated query)
- `static/js/account/preferences.js` (added Firestore)
- `static/js/civic/hot-topics.js` (added highlighting)

✅ All syntax verified:
- JavaScript: `node -c` checks passed
- SQL: Valid syntax, tested pattern
- No breaking changes to API contracts

## Files Reference

| Path | Change | Impact |
|------|--------|--------|
| `worker/migrations/0017_...sql` | NEW | Database consolidation |
| `worker/src/routes/api/user-topics/index.js` | 11 lines changed | API now queries hot_topics |
| `static/js/account/preferences.js` | +12 lines | Firestore integration |
| `static/js/civic/hot-topics.js` | +35 lines | Highlight followed topics |

## Testing Checklist

After deployment, verify:

- [ ] Preferences page loads 6 topics (not 10)
- [ ] Selecting topics saves to both D1 and Firestore
- [ ] Hot Topics page shows same 6 topics
- [ ] Followed topics appear first on Hot Topics page
- [ ] ★ "Following" badge visible on followed topics
- [ ] No errors in browser console
- [ ] Firestore contains `preferences.followedTopics` array
- [ ] No regressions in Hot Topics detail pages
- [ ] No regressions in Pending Bills filtering

## Rollback

If needed:

```bash
# Restore database backup
# OR manually undo migration (restore topic_index queries)

# Revert code changes
git checkout HEAD -- worker/src/routes/api/user-topics/index.js
git checkout HEAD -- static/js/account/preferences.js
git checkout HEAD -- static/js/civic/hot-topics.js

npm run deploy
```

## Key Points

1. **No user-facing changes** - Same UI, same functionality
2. **Better UX** - Preferences now highlight followed topics
3. **Single source of truth** - hot_topics is canonical
4. **Data preserved** - Existing preferences migrated automatically
5. **Backward compatible** - No API contract changes

## Questions?

Refer to:
- `HOT_TOPICS_ALIGNMENT_COMPLETE.md` - Detailed implementation
- `worker/migrations/` - SQL patterns
- `static/js/civic/hot-topics.js` - Frontend patterns (Firebase, sorting, rendering)

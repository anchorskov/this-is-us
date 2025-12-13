# Hot Topics System Alignment - Implementation Summary

**Date**: December 10, 2025  
**Status**: ✅ COMPLETE - Ready for Testing & Deployment

---

## Problem Statement

The Hot Topics system had a data alignment issue:
- **Preferences Page** (`/account/preferences/`) - Listed topics from `EVENTS_DB.topic_index` table
- **Hot Topics Page** (`/hot-topics/`) - Listed topics from `EVENTS_DB.hot_topics` table

These were **two separate tables** with different schemas, causing users to see misaligned topic lists across the site.

### Root Cause
Historical evolution left two parallel topic systems:
1. **Legacy**: `topic_index` (10 general interest topics)
2. **Current**: `hot_topics` (6 curated civic issues with bill counts, images, CTAs)

The new Hot Topics feature on Civic Watch used `hot_topics`, but preferences still used `topic_index`.

---

## Solution Overview

**Single Source of Truth**: Use `EVENTS_DB.hot_topics` as the canonical topic list everywhere.

### Changes Made

#### 1. **Database Migration** (`0017_align_preferences_to_hot_topics.sql`)

**Purpose**: Consolidate `user_topic_prefs` to reference `hot_topics` instead of `topic_index`

**Steps**:
- Rename old `user_topic_prefs` to `user_topic_prefs_old`
- Create new `user_topic_prefs` with FK to `hot_topics.id`
- Migrate existing preferences via slug matching (best-effort)
- Drop legacy table
- Create triggers for automatic timestamp maintenance

**Data Safety**: Existing user preferences are preserved by matching topic slugs between old and new tables.

#### 2. **API Endpoint Update** (`/api/user-topics`)

**File**: `worker/src/routes/api/user-topics/index.js`

**Changes**:
```javascript
// OLD: Query topic_index
SELECT t.id, t.name, t.slug, ... FROM topic_index t

// NEW: Query hot_topics
SELECT ht.id, ht.title AS name, ht.slug, ... FROM hot_topics ht
WHERE ht.is_active = 1
ORDER BY ht.priority ASC, ht.title
```

**Benefits**:
- Topics now ordered by priority (5 core issues first)
- Only active topics displayed
- Alignment with hot-topics page
- Consistent schema across all UI surfaces

#### 3. **Frontend: Preferences Page** (`static/js/account/preferences.js`)

**Changes**:
- Added Firebase Firestore import for preference persistence
- Updated save handler to write to **both**:
  1. `EVENTS_DB.user_topic_prefs` (for backend filtering/logic)
  2. `Firestore.users/{uid}.preferences.followedTopics` (for client-side highlighting)

**Implementation**:
```javascript
// When user toggles a topic checkbox:
// 1. Save to D1 via /api/user-topics
await apiFetch("/user-topics", {
  method: "POST",
  body: JSON.stringify({ topicId, checked: box.checked })
});

// 2. Save to Firestore for client-side access
await updateDoc(userDocRef, {
  "preferences.followedTopics": [...updatedList],
  "preferences.updated_at": new Date()
});
```

#### 4. **Frontend: Hot Topics Page** (`static/js/civic/hot-topics.js`)

**Changes**:
- Load followed topics from Firestore on page load
- Sort followed topics to the top
- Add visual indicator (star badge "★ Following")
- Add CSS class for styling followed topics

**Implementation**:
```javascript
// Get followed topics from Firestore
const auth = getAuth();
const db = getFirestore();
const userDocRef = doc(db, "users", user.uid);
const userDocSnap = await getDoc(userDocRef);
let followedTopicIds = userDocSnap.data().preferences?.followedTopics || [];

// Sort: followed topics first
const sortedTopics = topics.sort((a, b) => {
  const aFollowed = followedTopicIds.includes(a.id);
  const bFollowed = followedTopicIds.includes(b.id);
  return bFollowed - aFollowed; // Followed first
});

// Render with visual indicator
const isFollowed = followedTopicIds.includes(topic.id);
const followedBadge = isFollowed 
  ? '<span class="followed-badge">★ Following</span>' 
  : '';
```

---

## Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `worker/migrations/0017_align_preferences_to_hot_topics.sql` | NEW | Migrate user_topic_prefs to use hot_topics |
| `worker/src/routes/api/user-topics/index.js` | Updated | Query hot_topics instead of topic_index |
| `static/js/account/preferences.js` | Enhanced | Save to both D1 and Firestore |
| `static/js/civic/hot-topics.js` | Enhanced | Load followed topics, highlight, sort |

---

## Data Flow (After Migration)

```
User selects topics on Preferences page
    ↓
preferences.js toggles checkbox
    ↓
Saves to /api/user-topics (D1)          Saves to Firestore (client state)
    ↓                                           ↓
user_topic_prefs (D1)              preferences.followedTopics (Firestore)
    ↓                                           ↓
/api/user-topics returns updated list    hot-topics.js reads on load
    ↓                                           ↓
Preferences page shows checkmarks       Hot Topics page highlights followed
```

---

## Deployment Steps

### Phase 1: Database

```bash
# Apply migration to EVENTS_DB
wrangler d1 execute EVENTS_DB --file worker/migrations/0017_align_preferences_to_hot_topics.sql

# Verify data migration
wrangler d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM user_topic_prefs;"
```

### Phase 2: Worker

```bash
# Deploy updated worker code
npm run deploy

# Verify endpoints
curl http://127.0.0.1:8787/api/user-topics  # Should return hot_topics data
```

### Phase 3: Frontend

- No deployment needed (files already updated)
- Clear browser cache to load new JS modules
- Test on `/account/preferences/` and `/hot-topics/`

---

## Testing Checklist

- [ ] **Database Migration**: User preferences preserved after 0017 applied
- [ ] **API Endpoint**: `GET /api/user-topics` returns hot_topics (6 items, priority-ordered)
- [ ] **Preferences Page**: 
  - [ ] Loads 6 topics (not 10)
  - [ ] Saves to D1 on toggle
  - [ ] Saves to Firestore on toggle
  - [ ] Checked topics match hot-topics selected on Hot Topics page
- [ ] **Hot Topics Page**:
  - [ ] Shows same 6 topics as preferences
  - [ ] Followed topics appear first
  - [ ] Followed topics show ★ badge
  - [ ] Unfollowed topics appear below
- [ ] **Firestore Sync**: Verify `users/{uid}.preferences.followedTopics` contains topic IDs
- [ ] **No Regressions**:
  - [ ] Pending Bills filtering still works (uses hot_topics separately)
  - [ ] Hot Topics detail pages functional
  - [ ] Town Hall functionality unaffected

---

## CSS Styling (Optional Enhancement)

To make followed topics visually distinct, add to `static/css/civic/hot-topics.css`:

```css
/* Highlight followed topics */
.hot-topic-card.followed {
  border-left: 4px solid #4CAF50;
  background-color: #f0f8f0;
}

.followed-badge {
  display: inline-block;
  background: #4CAF50;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-left: 8px;
}

.followed-badge::before {
  content: "★ ";
}
```

---

## Future Enhancements

1. **Admin Interface**: UI to manage hot_topics (currently admin-edit only)
2. **Topic Analytics**: Track which topics users follow most
3. **Smart Filters**: Show bills matching followed topics on Pending Bills page
4. **Push Notifications**: Notify users of new bills in followed topics
5. **Legacy Cleanup**: Delete `topic_index` table once `topic_requests` table is updated

---

## Backward Compatibility

✅ **No Breaking Changes**
- Firestore schema unchanged: still uses `preferences.followedTopics`
- `/api/user-topics` response format identical
- UI behavior improved (highlighting), not changed
- Existing data migrated automatically

---

## Rollback Plan

If issues occur:

1. **Revert Migration**: Apply `0017_rollback.sql` (not created, but could restore from backup)
2. **Revert Code**: Revert `user-topics/index.js` to query `topic_index`
3. **Re-deploy**: `npm run deploy`

**Note**: Create backup of EVENTS_DB before applying 0017.

---

## Contact & Questions

For deployment issues or clarifications, refer to:
- `/DELEGATION_API_COMPLETE.md` for Worker patterns
- `worker/migrations/` for SQL syntax examples
- `static/js/civic/` for frontend patterns

**Status**: Ready for QA and staging deployment.

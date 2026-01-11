# Hot Topics Alignment - Deployment Checklist

**Status**: Ready for Code Review & Deployment  
**Date**: December 10, 2025

---

## Pre-Deployment Review

### Code Changes
- [ ] **Migration 0017**: Review `worker/migrations/0017_align_preferences_to_hot_topics.sql`
  - [ ] Foreign key constraints properly disabled/re-enabled
  - [ ] Data migration logic (slug matching) correct
  - [ ] Triggers created for timestamps
  
- [ ] **API Endpoint**: Review `worker/src/routes/api/user-topics/index.js`
  - [ ] Query changed from `topic_index` to `hot_topics`
  - [ ] Added `WHERE is_active = 1` filter
  - [ ] Ordering changed to `priority ASC, title`
  - [ ] Response format unchanged
  
- [ ] **Preferences UI**: Review `static/js/account/preferences.js`
  - [ ] Firestore imports added (getFirestore, doc, updateDoc, getDoc)
  - [ ] Save handler saves to both D1 and Firestore
  - [ ] `preferences.followedTopics` array structure correct
  
- [ ] **Hot Topics Page**: Review `static/js/civic/hot-topics.js`
  - [ ] Firebase auth integration present
  - [ ] Firestore read logic correct
  - [ ] Sort logic puts followed topics first
  - [ ] ★ Badge rendering correct
  - [ ] Graceful fallback for unauthenticated users

### Testing Before Deployment
- [ ] All syntax checks pass:
  ```bash
  node -c static/js/account/preferences.js
  node -c static/js/civic/hot-topics.js
  bash HOT_TOPICS_ALIGNMENT_VERIFICATION.sh
  ```
- [ ] Review migration in safe environment first
- [ ] Test data migration logic (slug matching)

---

## Database Deployment (EVENTS_DB)

### Pre-Migration Checklist
- [ ] **Backup**: Create backup of EVENTS_DB
  ```bash
  # Recommended: Take D1 snapshot or backup before migration
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM user_topic_prefs;" --json
  ```
  
- [ ] **Verify Current State**:
  ```bash
  # Check topic_index exists
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM topic_index;" --json
  
  # Check user_topic_prefs count
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM user_topic_prefs;" --json
  
  # Check hot_topics exists
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM hot_topics;" --json
  ```

### Migration Steps
- [ ] **Apply Migration**:
  ```bash
  ./scripts/wr d1 execute EVENTS_DB --file worker/migrations/0017_align_preferences_to_hot_topics.sql
  ```

- [ ] **Verify Migration Success**:
  ```bash
  # Check new table schema
  ./scripts/wr d1 execute EVENTS_DB --command "PRAGMA table_info(user_topic_prefs);" --json
  
  # Check row count (should be similar to before)
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM user_topic_prefs;" --json
  
  # Check FK integrity
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM user_topic_prefs WHERE topic_id NOT IN (SELECT id FROM hot_topics);" --json
  # Result should be 0 (no orphaned rows)
  ```

### Rollback Plan (if needed)
- [ ] **Restore from backup**:
  ```bash
  # Apply previous working backup
  # OR manually restore topic_index queries in code
  ```

---

## Worker Deployment

### Pre-Deployment Checklist
- [ ] All code changes complete
- [ ] Syntax verified
- [ ] Documentation reviewed
- [ ] Database migration applied and verified

### Deployment Steps
- [ ] **Deploy**:
  ```bash
  npm run deploy
  ```

- [ ] **Verify Deployment**:
  ```bash
  # Test /api/user-topics endpoint
  curl http://127.0.0.1:8787/api/user-topics
  # Should return array of 6 hot_topics
  
  # Check for errors
  curl http://127.0.0.1:8787/api/user-topics 2>&1 | grep -i error
  # Should return no errors
  ```

### Rollback Plan (if needed)
- [ ] **Revert code**:
  ```bash
  git checkout HEAD -- worker/src/routes/api/user-topics/index.js
  npm run deploy
  ```

---

## Frontend Testing (Local/Staging)

### Clear Cache & Load
- [ ] Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- [ ] Disable service worker caching
- [ ] Open DevTools → Console for error monitoring

### Preferences Page (`/account/preferences/`)
- [ ] **Load Page**:
  - [ ] No console errors
  - [ ] 6 topics load (not 10)
  - [ ] Topics in priority order:
    1. Property Tax Relief
    2. Water Rights
    3. Education Funding
    4. Energy Permitting
    5. Public Safety & Fentanyl
    6. Housing & Land Use

- [ ] **Toggle Topics**:
  - [ ] Check a topic → "Preference saved!" message
  - [ ] Uncheck topic → message appears
  - [ ] No console errors
  - [ ] Spinner shows/hides correctly

- [ ] **Verify Persistence**:
  - [ ] Check Firestore: `users/{uid}.preferences.followedTopics` contains topic IDs
  - [ ] Check D1: `SELECT * FROM user_topic_prefs WHERE user_id = '{uid}';` returns selected topics

### Hot Topics Page (`/hot-topics/`)
- [ ] **Load Page**:
  - [ ] No console errors
  - [ ] 6 topics render
  - [ ] Same topics as preferences page

- [ ] **Verify Highlighting**:
  - [ ] Topics from Firestore `preferences.followedTopics` appear first
  - [ ] ★ "Following" badge visible on followed topics
  - [ ] Unfollowed topics appear below
  - [ ] Cards have `.followed` CSS class (inspect element)

- [ ] **Test Interaction**:
  - [ ] Click topic card → navigates to detail page
  - [ ] Detail page loads correctly
  - [ ] Back button returns to list

### Cross-Browser Testing
- [ ] **Desktop**:
  - [ ] Chrome: Latest version
  - [ ] Firefox: Latest version
  - [ ] Safari: Latest version

- [ ] **Mobile**:
  - [ ] iOS Safari: iPad/iPhone
  - [ ] Android Chrome: Phone/tablet

---

## Regression Testing

### Core Features
- [ ] **Pending Bills**:
  - [ ] Navigate to `/civic/pending/`
  - [ ] Filter by topic works
  - [ ] Topic list unchanged
  
- [ ] **Hot Topics Detail**:
  - [ ] Click topic → detail page loads
  - [ ] Bills display correctly
  - [ ] No errors

- [ ] **Town Hall**:
  - [ ] Navigate to `/townhall/`
  - [ ] Functionality unchanged
  - [ ] No errors

### UI/UX
- [ ] Responsive design intact
- [ ] No layout shifts
- [ ] Images load properly
- [ ] Forms submit correctly

---

## Production Deployment

### Final Checks
- [ ] Code review approved
- [ ] Staging tests pass
- [ ] Backup created
- [ ] Deployment window identified

### Deployment
- [ ] **Backup EVENTS_DB** (mandatory):
  ```bash
  # Take snapshot or backup before migration
  ```

- [ ] **Apply Migration**:
  ```bash
  ./scripts/wr d1 execute EVENTS_DB --file worker/migrations/0017_align_preferences_to_hot_topics.sql
  ```

- [ ] **Verify Migration**:
  ```bash
  ./scripts/wr d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM user_topic_prefs;" --json
  ```

- [ ] **Deploy Worker**:
  ```bash
  npm run deploy
  ```

- [ ] **Smoke Test**:
  - [ ] Visit `/account/preferences/` → 6 topics load
  - [ ] Visit `/hot-topics/` → 6 topics load
  - [ ] Select a topic → saves without error
  - [ ] Check browser console → no errors

### Post-Deployment Monitoring
- [ ] Monitor worker logs for errors
- [ ] Check Firestore writes: verify `preferences.followedTopics` populated
- [ ] Monitor D1 query performance
- [ ] Collect user feedback

---

## Rollback Decision Tree

**If migration fails on DB:**
- Restore from backup
- Revert API code (query topic_index)
- Redeploy worker
- Investigate issue, create new migration

**If API endpoint fails:**
- Revert code
- Redeploy
- Investigate issue

**If frontend breaks:**
- Clear cache
- Check console errors
- Review JavaScript changes
- Revert if needed

**Critical Issue (user-facing):**
- Activate incident response
- Roll back to previous state
- Investigate
- Deploy fix to staging first

---

## Documentation & Knowledge Transfer

- [ ] `HOT_TOPICS_ALIGNMENT_INDEX.md` - Overview
- [ ] `HOT_TOPICS_ALIGNMENT_COMPLETE.md` - Detailed reference
- [ ] `HOT_TOPICS_ALIGNMENT_QUICK_REFERENCE.md` - Quick guide
- [ ] `HOT_TOPICS_ALIGNMENT_VERIFICATION.sh` - Automation script
- [ ] This checklist - Deployment process

### Team Handoff
- [ ] Document shared with team
- [ ] Team walkthrough completed
- [ ] Questions answered
- [ ] Runbook approved

---

## Success Criteria

### Functional Requirements ✅
- [ ] Preferences page displays 6 topics
- [ ] Hot Topics page displays 6 topics
- [ ] Topics are identical across pages
- [ ] Preferences save to D1 and Firestore
- [ ] Followed topics appear first on Hot Topics
- [ ] ★ Badge appears on followed topics

### Non-Functional Requirements ✅
- [ ] No breaking changes to APIs
- [ ] Existing data preserved
- [ ] No performance degradation
- [ ] Graceful fallback for edge cases
- [ ] Backward compatible schema

### User Experience ✅
- [ ] Consistent topic list across site
- [ ] Visual feedback for followed topics
- [ ] No confusing misalignments
- [ ] Seamless preference saving

---

## Sign-Off

- **Code Reviewer**: _________________ Date: _______
- **QA Tester**: _________________ Date: _______
- **DevOps/Deployment**: _________________ Date: _______
- **Product**: _________________ Date: _______

---

**Checklist Version**: 1.0  
**Last Updated**: 2025-12-10  
**Status**: Ready for Use

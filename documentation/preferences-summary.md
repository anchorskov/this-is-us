# Preferences & Topic Moderation Feature Overview

This document summarizes the functionality, structure, and access control logic added to the project to support user preferences and topic moderation.

---

## ✅ Overview

This feature allows:
- Verified users to select political topics they care about
- Users to request new topics (stored in D1 for moderation)
- Admins to approve or reject topic requests from a dashboard

---

## 📁 Files Included

### Hugo Content & Layout
- `content/account/preferences.md`: Preferences page
- `content/account/topic-requests.md`: Admin topic moderation page
- `layouts/account/preferences.html`: User form UI
- `layouts/account/topic-requests.html`: Admin dashboard UI

### Static JS
- `static/js/account/preferences.js`: Handles topic checkbox selection & submission
- `static/js/account/topic-requests.js`: Admin topic moderation actions

### Worker Logic (Cloudflare)
- `worker/src/account/preferences.js`: API logic for GET/POST preferences
- `worker/src/account/topic-requests.js`: API logic for GET/POST admin moderation
- `worker/src/index.mjs`: Route registration
- `worker/migrations/0005_add_preferences.sql`: D1 schema for topics, preferences, topic_requests

---

## 🔐 Access Control Summary

### Firebase (via verifySession)
- Only `email_verified` users can access `/api/preferences`
- Only `email_verified` users with `isAdmin = true` can access `/api/topic-requests`

### D1 Schema Tables
- `topic_index (id, name, slug)`
- `user_topic_prefs (user_id, topic_id)`
- `topic_requests (id, user_id, user_email, proposed_name, status, submitted_at)`

---

## 🔒 Firestore Rules (if used)
No changes needed unless mirroring data to Firestore. For completeness:

```js
match /users/{userId} {
  allow get: if (resource.data.keys().hasOnly(['displayName', 'city', 'state'])) ||
                (request.auth != null && request.auth.uid == userId);
  allow create, delete, update: if request.auth != null && request.auth.uid == userId;
  allow delete: if getRoleLevel() >= 80;
}
```

---

## 🚀 Future Improvements
- Rate limit topic submissions
- Admin search & pagination for topic requests
- Tagging topics by category (e.g., economy, civil rights, environment)


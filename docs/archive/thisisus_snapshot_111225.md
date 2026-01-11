# This Is Us – Snapshot (2025-11-12)

## Current State Summary
- Hugo + PaperMod front-end wired to Firebase Auth/UI; Cloudflare Worker backs events, town hall CRUD, preferences, and Stripe endpoints.
- Town Hall UI still reads/writes directly to Firestore while new Worker/D1 routes sit unused, so moderation, retention, and auth rules diverge quickly.
- Worker APIs trust caller-supplied `user_id`/`role` fields and ship `Access-Control-Allow-Origin: *`, making it trivial for a malicious site to impersonate users or delete posts.
- Event creation UI and Worker disagree on payload shape (`user_id` vs `userId`, camel vs snake case) and file storage is stubbed, so submissions silently fail and PDFs never reach R2.
- Local Hugo server targets production APIs unless `?useLocalWorker=1` is set, increasing the risk of accidental prod mutations during design work.

## Recommended Upgrade Direction
We should converge on a combined Google Firestore + Cloudflare Zero Trust + Cloudflare D1 Worker stack for user access and data governance:
1. **Auth Gate (Firestore):** Users authenticate via Firebase Auth (email/SMS/Passkey). Upon sign-in we mint an ID token and attach it as `Authorization: Bearer <token>` for every Worker call.
2. **Voter Verification (Firestore/D1):** When `verifySession` runs inside the Worker, look up the user’s Wyoming voter status (e.g., Firestore `profiles` collection or a dedicated D1 table seeded from the voter file). Block mutations until `verifiedWyomingVoter === true`.
3. **Zero Trust Barrier:** Eligible users must additionally pass through a Cloudflare Access/Zero Trust policy (e.g., service token or mTLS) before they hit privileged Worker routes. This gives us device posture + IP controls beyond Firebase identity.
4. **D1 as Source of Truth:** Town hall threads, replies, and moderation queues should persist in D1. Workers become the only write path; Hugo/SPA clients talk to `/api/townhall/*` instead of Firestore collections. Firestore stays for auth/session storage only.
5. **Least-Privilege APIs:** Replace form-posted `user_id` parameters with server-side values from verified tokens; tighten CORS to the production origin(s) and require Zero Trust headers for destructive operations.

## Action Items
- Refactor `static/js/townhall/*` controllers to call the Worker endpoints once token exchange + Zero Trust headers are in place.
- Finish the `/api/events/create` upload flow: align field names, stream PDFs into R2, and return signed URLs from D1 to the frontend.
- Update `site-scripts.html` so local Hugo defaults to the local Worker, reducing accidental prod writes during the redesign.
- Document the end-to-end auth path (Firebase login → voter check → Zero Trust → Worker) for designers and contributors so the new requirements stay enforceable.

# Logic Index – This Is Us Project (v3.4)


### `logic-index.md`

**Summary**: # Logic Index – This Is Us Project (v2) ### `logic-index.md` ### `tailwind.config.js`

**Definitions**:
- `(no defs)`

### `README.md`

**Summary**: // README.md # This Is Us – Project Overview ## Folder Overview

**Definitions**:
- `extract_definitions`
- `extract_summary`
- `walk_directory`

### `tailwind.config.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `logic-index-v3.md`

**Summary**: # Logic Index – This Is Us Project (v3.3) ### `logic-index.md` ### `README.md`

**Definitions**:
- `(no defs)`

### `config.toml`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `setup_this_is_us.py`

**Summary**: # Windows Downloads folder path # Target WSL Hugo project path # Validate zip file

**Definitions**:
- `(no defs)`

### `contentballot.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `data/0002_seed_townhall_posts.sql`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `data/0001_create_townhall_posts.sql`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `tests/conftest.py`

**Summary**: # tests/conftest.py # Determine paths # Execute Wrangler CLI to clear preview DB

**Definitions**:
- `clear_preview_db`

### `tests/test_events_api.py`

**Summary**: # tests/test_events_api.py # Accept either creation or duplicate as valid # First upload: either new or already exists

**Definitions**:
- `test_create_event`
- `test_duplicate_pdf`

### `ballots/wrangler.toml`

**Summary**: # ballots/wrangler.toml

**Definitions**:
- `(no defs)`

### `ballots/src/index.mjs`

**Summary**: // ballots/src/index.mjs // Utility to add CORS headers to responses // ✅ Preflight CORS support

**Definitions**:
- `withCors`

### `ballots/tools/fetchBallotForZip.js`

**Summary**: // ballots/tools/fetchBallotForZip.js

**Definitions**:
- `fetchBallotForZip`

### `ballots/tools/generateBallotFromSources.js`

**Summary**: // ballots/tools/generateBallotFromSources.js

**Definitions**:
- `generateBallotFromSources`

### `worker/wrangler.toml`

**Summary**: # File: worker/wrangler.toml # ✅ Enable bindings for local development # ✅ Production environment configuration

**Definitions**:
- `(no defs)`

### `worker/src/index.mjs`

**Summary**: // worker/src/index.mjs // Serve PDF files via Worker to avoid cross-origin issues // List future events for display

**Definitions**:
- `(no defs)`

### `worker/src/routes/sandbox.js`

**Summary**: // worker/src/routes/sandbox.js // 🔐 Require authenticated user with at least an email

**Definitions**:
- `handleSandboxAnalyze`

### `worker/src/townhall/listPosts.js`

**Summary**: // worker/src/routes/townhall/listPost.js

**Definitions**:
- `handleListTownhallPosts`

### `worker/src/townhall/deletePost.js`

**Summary**: // worker/src/routes/townhall/deletePost.js // Fetch the post // Authorization check

**Definitions**:
- `handleDeleteTownhallPost`

### `worker/src/townhall/createPost.js`

**Summary**: // worker/src/townhall/createPost.js // Validate required field // Limit file size to 2MB

**Definitions**:
- `handleCreateTownhallPost`

### `worker/src/townhall/utils.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `worker/migrations/0002_add_contact_fields.sql`

**Summary**: -- Migration number: 0002 	 2025-05-06T01:59:36.409Z

**Definitions**:
- `(no defs)`

### `worker/migrations/0001_add_events_table.sql`

**Summary**: -- Migration number: 0001 	 2025-05-05T12:07:43.590Z

**Definitions**:
- `(no defs)`

### `scripts/summarize-logic.py`

**Summary**: # summarize-logic.py – v3.4 (Town Hall Debug Edition) -------------------- --------------

**Definitions**:
- `audit_townhall`
- `colour`
- `extract_defs`
- `extract_summary`
- `main`
- `should_skip`
- `walk_directory`

### `layouts/index.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/candidates-single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/baseof.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/list.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/onthemeupdate.md`

**Summary**: # onthemeupdate.md ## Project: This Is US (Hugo + PaperMod) ---

**Definitions**:
- `(no defs)`

### `layouts/shortcodes/card.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/shortcodes/sandboxpromo.html`

**Summary**: (no summary)

**Definitions**:
- `checkSandboxAuth`

### `layouts/shortcodes/candidates-list.html`

**Summary**: (no summary)

**Definitions**:
- `candidateList`

### `layouts/login/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/admin/users.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/admin/threads.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/ballot/list.html`

**Summary**: // 🌐 Dynamic API base

**Definitions**:
- `(no defs)`

### `layouts/ballot/index.html`

**Summary**: // Step 1: Fetch sources from your D1 // Step 2: Pass sources to AI // Step 3: Render result

**Definitions**:
- `(no defs)`

### `layouts/section/townhall.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/account/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/sandbox/single.html`

**Summary**: (no summary)

**Definitions**:
- `sandboxGate`

### `layouts/sandbox/interactive.html`

**Summary**: (no summary)

**Definitions**:
- `sandboxFlow`

### `layouts/events/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/events/create.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/events/section.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/events/hub.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/candidates/list.html`

**Summary**: (no summary)

**Definitions**:
- `candidateList`

### `layouts/candidates/upload.html`

**Summary**: // Ensure clean API base — avoids double `/api/api/...`

**Definitions**:
- `(no defs)`

### `layouts/townhall/map.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/townhall/reply-form.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/townhall/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/townhall/thread.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/townhall/create.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/townhall/threads.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/cover.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/index_profile.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/author.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/home_info.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/extend_head.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/footer.html`

**Summary**: // td containing LineNos // table containing LineNos and code // code blocks not having highlight as parent class

**Definitions**:
- `copyingDone`

### `layouts/partials/site-scripts.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/event-card.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/firebase-init.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/floating-auth.html`

**Summary**: // Check Firebase loaded // Defer until FirebaseAuth is stable

**Definitions**:
- `(no defs)`

### `layouts/partials/extend_footer.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/anchored_headings.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/post_meta.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/breadcrumbs.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/head.html`

**Summary**: #theme-toggle, --theme: rgb(29, 30, 32); --entry: rgb(46, 46, 51);

**Definitions**:
- `(no defs)`

### `layouts/partials/header.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/google_analytics.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/event-form.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/templates/twitter_cards.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/templates/schema_json.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/templates/opengraph.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/_funcs/get-page-images.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/events/map-controls.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/candidates/warrior-directory.html`

**Summary**: (no summary)

**Definitions**:
- `candidateList`

### `content/donate.md`

**Summary**: --- --- /* full‑screen layout */

**Definitions**:
- `(no defs)`

### `content/manifesto.md`

**Summary**: --- --- ## Introduction: Alarm

**Definitions**:
- `when`

### `content/volunteer.md`

**Summary**: --- --- ---

**Definitions**:
- `(no defs)`

### `content/credits.md`

**Summary**: --- --- # 🙏 Credits & Transparency

**Definitions**:
- `(no defs)`

### `content/podcast.md`

**Summary**: --- --- ## This Is US Podcast

**Definitions**:
- `(no defs)`

### `content/_index.md`

**Summary**: --- --- ---

**Definitions**:
- `(no defs)`

### `content/about.md`

**Summary**: --- --- ## Why We Exist

**Definitions**:
- `(no defs)`

### `content/voices.md`

**Summary**: --- --- ## Share Your Story

**Definitions**:
- `(no defs)`

### `content/contact.md`

**Summary**: --- --- ## Get in Touch

**Definitions**:
- `(no defs)`

### `content/account.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/login/index.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/ballot/_index.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `content/sandbox/index.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/events/hub.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/events/create.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/events/_index.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/candidates/_index.md`

**Summary**: --- --- # Be Seen. Be Trusted. Be Part of Something Bigger Than Politics.

**Definitions**:
- `(no defs)`

### `content/candidates/upload.md`

**Summary**: --- ---

**Definitions**:
- `(no defs)`

### `content/townhall/map.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `content/townhall/_index.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `content/townhall/create/index.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `content/townhall/threads/_index.md`

**Summary**: # content/townhall/threads/_index.md --- ---

**Definitions**:
- `(no defs)`

### `content/townhall/thread/index.md`

**Summary**: # content/townhall/thread/index.md --- ---

**Definitions**:
- `(no defs)`

### `static/js/admin-threads.js`

**Summary**: // static/js/admin-threads.js // Initial fetch // Sort handler

**Definitions**:
- `(no defs)`

### `static/js/firebase-auth-guard.js`

**Summary**: // /static/js/firebase-auth-guard.js // Paths that require a logged-in user // Wait until Firebase is ready

**Definitions**:
- `(no defs)`

### `static/js/events.js`

**Summary**: // Cleaned events.js

**Definitions**:
- `(no defs)`

### `static/js/townhall.js`

**Summary**: // static/js/townhall.js // Handles Firebase-authenticated Town Hall posts via Cloudflare D1 and R2 // 🧠 Personalize prompt

**Definitions**:
- `fetchResponses`
- `prependResponse`

### `static/js/thread-replies.js`

**Summary**: // /static/js/thread-replies.js // Attach replies UI under each thread (after threads are rendered) // Load existing replies

**Definitions**:
- `(no defs)`

### `static/js/account.js`

**Summary**: // Logic for populating and updating the /account/ page with Firebase authentication and Firestore // Pre-fill form // Set global role for admin UI detection

**Definitions**:
- `showFeedback`

### `static/js/firebase-session.js`

**Summary**: // static/js/firebase-session.js // 🔓 Optional logout button logic

**Definitions**:
- `(no defs)`

### `static/js/firebase-idle-logout.js`

**Summary**: // static/js/firebase-idle-logout.js // User activity events to reset timer

**Definitions**:
- `(no defs)`

### `static/js/event-list.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `static/js/firebase-ui-config.js`

**Summary**: // Delay to ensure auth state is synced

**Definitions**:
- `(no defs)`

### `static/js/firebase-config.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `static/js/reply-form.js`

**Summary**: // static/js/reply-form.js

**Definitions**:
- `(no defs)`

### `static/js/firebase-login.js`

**Summary**: // static/js/firebase-login.js

**Definitions**:
- `(no defs)`

### `static/js/admin-users.js`

**Summary**: // static/js/admin-users.js // Initial render // Search filter

**Definitions**:
- `renderTable`

### `static/js/leafletzipsearch.js`

**Summary**: // Autofill workaround: detect changes periodically

**Definitions**:
- `createZipSearchBox`
- `handleZipSearch`

### `static/js/utils/safe-fetch.js`

**Summary**: // network‐OK but HTTP error // non‐JSON error payload // success path: parse JSON (or return text if you prefer)

**Definitions**:
- `safeFetch`

### `static/js/utils/parse-latlng.js`

**Summary**: // static/js/utils/parse-latlng.js /**

**Definitions**:
- `parseLatLng`

### `static/js/events/ui-feedback.js`

**Summary**: // —————————————————————————————————————————— // Simple DOM selector // ——————————————————————————————————————————

**Definitions**:
- `bindPdfPreview`
- `showError`
- `showSuccess`
- `showSuccessModal`
- `showToast`
- `toggleLoading`

### `static/js/events/event-map.js`

**Summary**: // static/js/events/event-map.js // —————————————————————————————————————————— // Simple selector

**Definitions**:
- `bindAddressSearch`
- `initMap`
- `setMarker`

### `static/js/events/event-form.js`

**Summary**: // static/js/events/event-form.js /** // 1) PDF size guard

**Definitions**:
- `bindConfirm`
- `bindFormLogic`
- `handlePreview`
- `handleSubmit`
- `renderForm`
- `resetForm`

### `static/js/events/validation-utils.js`

**Summary**: // validation-utils.js — Reusable field validation utilities

**Definitions**:
- `areRequiredFieldsPresent`
- `isFutureDate`
- `isValidEmail`
- `isValidPhone`

### `static/js/events/preview-renderer.js`

**Summary**: // static/js/events/preview-renderer.js /** // Normalize keys

**Definitions**:
- `renderPreview`

### `static/js/events/index.js`

**Summary**: // static/js/events/index.js /** // Show the form: remove hidden, add flex-layout classes

**Definitions**:
- `(no defs)`

### `static/js/events/events-discover.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `static/js/events/submit-event.js`

**Summary**: // static/js/events/submit-event.js // —————————————————————————————————————————— // Configuration

**Definitions**:
- `submitEvent`

### `static/js/events/form-state.js`

**Summary**: (no summary)

**Definitions**:
- `collectFormData`

### `static/js/events/populate-map.js`

**Summary**: // static/js/events/populate-map.js /**

**Definitions**:
- `populateMap`

### `static/js/events/error-manager.js`

**Summary**: // static/js/events/error-manager.js /**

**Definitions**:
- `getUserFriendlyError`

### `static/js/events/hub.js`

**Summary**: // static/js/events/hub.js

**Definitions**:
- `initHub`
- `renderEvents`
- `zoomToZip`

### `static/js/townhall/threads.js`

**Summary**: /* --------------------------------------------------------- --------------------------------------------------------- */ /* ── Render one thread doc into a card ───────────────────────── */

**Definitions**:
- `loadMore`
- `renderCard`

### `static/js/townhall/active.js`

**Summary**: // /static/js/townhall/active.js // Placeholder for future 'active threads' logic

**Definitions**:
- `(no defs)`

### `static/js/townhall/home.js`

**Summary**: /* --------------------------------------------------------- --------------------------------------------------------- */ /* 1️⃣  FIREBASE READY ---------------------------------------------------- */

**Definitions**:
- `attachFAB`
- `attachLocationControls`
- `attachTabs`
- `geocode`
- `getUserLocation`
- `initUI`
- `loadMine`
- `loadNearby`
- `loadTrending`
- `renderThreads`
- `showMap`

### `static/js/townhall/thread-view.js`

**Summary**: /* ────────────────────────────────────────────────────────────── // Firestore collection helpers // Extract threadId from query string or path

**Definitions**:
- `renderReplies`
- `renderSkeleton`
- `renderThreadHTML`
- `showError`
- `wireReplyForm`

### `static/js/townhall/create.js`

**Summary**: /*  static/js/townhall/create.js /* ── Firebase guard ─────────────────────────────────────── */ /* ── Submit handler ─────────────────────────────────────── */

**Definitions**:
- `(no defs)`

### `static/js/townhall/map.js`

**Summary**: /* ────────────────────────────────────────────────────────────── /* helper -------------------------------------------------- */ /* 0 • pre-flight ----------------------------------------- */

**Definitions**:
- `zoomToZip`

### `firebase-seeder/patch-giscus-urls.js`

**Summary**: // firebase-seeder/patch-giscus-urls.js // Authenticated GitHub clients // 🔎 Fetch all discussions from the repo

**Definitions**:
- `getGiscusThreads`
- `patchFirestoreThreads`

### `firebase-seeder/check-giscus-urls.js`

**Summary**: (no summary)

**Definitions**:
- `checkGiscusUrls`

### `firebase-seeder/full-reset-seeder.js`

**Summary**: // firebase-seeder/full-reset-seeder.js // Wipe + re-seed Firestore and Giscus threads // Config

**Definitions**:
- `clearFirestore`
- `createGiscusDiscussion`
- `deleteAllGiscusDiscussions`
- `seedAll`

### `firebase-seeder/seed.js`

**Summary**: // firebase-seeder/seed.js // Seeds townhall_threads with coordinates

**Definitions**:
- `seedTownhallThreads`

### `archetypes/default.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `archive_content/podcast.md`

**Summary**: --- --- ## 🎧 This Is Us: On the Other Side of Fear

**Definitions**:
- `(no defs)`

### `archive_content/_index.md`

**Summary**: --- --- ---

**Definitions**:
- `(no defs)`

### `archive_content/events.md`

**Summary**: --- --- ## Upcoming Events

**Definitions**:
- `(no defs)`

### `archive_content/about.md`

**Summary**: --- --- ## Why We Exist

**Definitions**:
- `(no defs)`

### `archive_content/voices.md`

**Summary**: --- --- ## Share Your Story

**Definitions**:
- `(no defs)`

### `archive_content/contact.md`

**Summary**: --- --- ## Get in Touch

**Definitions**:
- `(no defs)`

### `archive_content/learn.md`

**Summary**: --- --- ## Resources

**Definitions**:
- `(no defs)`

### `mcp/wrangler.toml`

**Summary**: # ./wrangler.toml # ✅ Move all bindings inside [env.production]

**Definitions**:
- `(no defs)`

### `mcp/src/index.mjs`

**Summary**: // mcp/src/index.mjs

**Definitions**:
- `(no defs)`

### `mcp/src/routes/candidate-upload.js`

**Summary**: // src/routes/candidate-upload.js // Generate a unique key for the PDF // Build the public URL for retrieving the PDF

**Definitions**:
- `handleCandidateUpload`

### `mcp/src/routes/candidate-file.js`

**Summary**: // mcp/src/routes/candidate-file.js // Attempt to fetch the PDF from R2 // Stream back the PDF with proper headers

**Definitions**:
- `handleCandidateFile`

### `mcp/src/routes/candidate-confirm.js`

**Summary**: // mcp/src/routes/candidate-confirm.js // Parse and log incoming payload // Validate

**Definitions**:
- `handleCandidateConfirm`

### `mcp/migrations/0003_add_candidates_table.sql`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `mcp/tools/subscribeToAlerts.js`

**Summary**: (no summary)

**Definitions**:
- `subscribeToAlerts`

### `mcp/tools/listCandidates.js`

**Summary**: (no summary)

**Definitions**:
- `listCandidates`

### `mcp/tools/parseCandidatePdf.js`

**Summary**: // mcp/tools/parseCandidatePdf.js // 🧩 Extract key from the URL // 📂 Load PDF from R2

**Definitions**:
- `parseCandidatePdf`

### `mcp/tools/warrior.mjs`

**Summary**: // mcp/src/tools/warrior.mjs // Use D1 to fetch by location (case-insensitive partial match) // Ensure pdf_url is populated

**Definitions**:
- `listWarriors`

### `mcp/tools/insertParsedCandidate.js`

**Summary**: // mcp/tools/insertParsedCandidate.js

**Definitions**:
- `insertParsedCandidate`

### `mcp/tools/getCandidatePdf.js`

**Summary**: (no summary)

**Definitions**:
- `getCandidatePdf`

### `mcp/tools/processCandidateUpload.js`

**Summary**: // mcp/tools/processCandidateUpload.js // Step 1: Parse the PDF // Step 2: Insert parsed candidate

**Definitions**:
- `processCandidateUpload`

## 🔍 Town Hall Debug Audit

### Layout templates

- `layouts/townhall/list.html` – [31m❌ missing[0m
- `layouts/townhall/thread.html` – [32m✅ found[0m
- `layouts/townhall/create.html` – [32m✅ found[0m
- `layouts/section/townhall.html` – [32m✅ found[0m

### Critical JS files

- `static/js/townhall/home.js` – [32m✅ found[0m
- `static/js/townhall/threads.js` – [32m✅ found[0m
- `static/js/townhall/thread-view.js` – [32m✅ found[0m

### Thread front‑matter sanity

- `content/townhall/thread/index.md` → [33missues: slug, lat, lon[0m
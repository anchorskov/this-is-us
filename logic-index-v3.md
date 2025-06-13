# Logic Index – This Is Us Project (v3.7)


### `logic-index.md`

**Summary**: # Logic Index – This Is Us Project (v2) ### `logic-index.md` ### `tailwind.config.js` ### `config.toml` ### `setup_this_is_us.py`

**Definitions**:
- `(no defs)`

### `README.md`

**Summary**: // README.md # This Is Us – Project Overview ## Folder Overview ### Active Project Sections (Tree Overview - `tree -L 2`) ---

**Definitions**:
- `extract_definitions`
- `extract_summary`
- `s`
- `walk_directory`

### `tailwind.config.js`

**Summary**: /** @type {import('tailwindcss').Config} */ // Keep Tailwind’s theme untouched for now // Add plugins if/when you need them // require('@tailwindcss/typography'), // Optional: whitelist dynamic classes (example)

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `export s`
- `require('@tailwindcss/typography')`

### `postcss.config.js`

**Summary**: // add other PostCSS plugins here if you need them later

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `export s`

### `logic-index-v3.md`

**Summary**: # Logic Index – This Is Us Project (v3.6) ### `logic-index.md` ### `README.md` ### `tailwind.config.js` ### `postcss.config.js`

**Definitions**:
- `(no defs)`

### `config.toml`

**Summary**: (no summary)

**Definitions**:
- `aultTheme`

### `setup_this_is_us.py`

**Summary**: # Windows Downloads folder path # Target WSL Hugo project path # Validate zip file # Clean up temp folder if it exists # Extract ZIP to temp path

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `import os
import zipfile
import shutil
from pathlib import Path`

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

**Imports/Exports**:
- `import subprocess
import os
import pytest`

### `tests/test_events_api.py`

**Summary**: # tests/test_events_api.py # Accept either creation or duplicate as valid # First upload: either new or already exists # Rewind & second upload must detect duplicate

**Definitions**:
- `test_create_event`
- `test_duplicate_pdf`

**Imports/Exports**:
- `import requests

BASE_URL`

### `ballots/wrangler.toml`

**Summary**: # ballots/wrangler.toml

**Definitions**:
- `(no defs)`

### `ballots/src/index.mjs`

**Summary**: // ballots/src/index.mjs // Utility to add CORS headers to responses // ✅ Preflight CORS support // ✅ GET /api/ballot?zip=XXXXX — returns source(s) from D1 // ✅ POST /api/ballot/generate — AI summarizes links

**Definitions**:
- `await`
- `new`
- `url`
- `withCors`

**Imports/Exports**:
- `export default`
- `import '../tools/fetchBallotForZip.js'`
- `import '../tools/generateBallotFromSources.js'`

### `ballots/tools/fetchBallotForZip.js`

**Summary**: // ballots/tools/fetchBallotForZip.js

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `export async`

### `ballots/tools/generateBallotFromSources.js`

**Summary**: // ballots/tools/generateBallotFromSources.js

**Definitions**:
- `await`

**Imports/Exports**:
- `export async`

### `worker/wrangler.toml`

**Summary**: # File: worker/wrangler.toml # ✅ Enable bindings for local development # ✅ Production environment configuration

**Definitions**:
- `(no defs)`

### `worker/src/index.mjs`

**Summary**: // worker/src/index.mjs // Serve PDF files via Worker to avoid cross-origin issues // List future events for display // Debug endpoint: see table schema // Create a new event

**Definitions**:
- `5`
- `Array`
- `Router`
- `await`
- `form`
- `new`
- `results`

**Imports/Exports**:
- `export default`
- `import './routes/sandbox.js'`
- `import './townhall/createPost.js'`
- `import './townhall/deletePost.js'`
- `import './townhall/listPosts.js'`
- `import 'itty-router'`

### `worker/src/routes/sandbox.js`

**Summary**: // worker/src/routes/sandbox.js // 🔐 Require authenticated user with at least an email

**Definitions**:
- `await`

**Imports/Exports**:
- `export async`

### `worker/src/townhall/listPosts.js`

**Summary**: // worker/src/routes/townhall/listPost.js

**Definitions**:
- `Math`
- `new`
- `results`
- `url`

**Imports/Exports**:
- `export async`

### `worker/src/townhall/deletePost.js`

**Summary**: // worker/src/routes/townhall/deletePost.js // Fetch the post // Authorization check // Delete from R2 if exists // Delete from D1

**Definitions**:
- `await`
- `form`
- `post`
- `results`
- `userRole`

**Imports/Exports**:
- `export async`

### `worker/src/townhall/createPost.js`

**Summary**: // worker/src/townhall/createPost.js // Validate required field // Limit file size to 2MB

**Definitions**:
- `0`
- `2`
- `await`
- `form`
- `new`
- `null`

**Imports/Exports**:
- `export async`

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

### `scripts/summarizev7.py`

**Summary**: # summarize-logic.py – v3.7 (HTML Stylesheet Analysis) -------------------- -------------- # Full project sweep, write logic-index-v3.md (default) # Focus on Town Hall only, print to stdout

**Definitions**:
- `analyze_file_code`
- `audit_api_endpoints`
- `audit_html_link_href`
- `audit_html_script_sources`
- `audit_hugo_partials`
- `audit_townhall`
- `colour`
- `extract_summary`
- `main`
- `should_skip`
- `walk_directory`

**Imports/Exports**:
- `from __future__ import Any

try`
- `from __future__ import Dict`
- `from __future__ import Set`
- `from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import List`
- `import frontmatter`

### `layouts/index.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/candidates-single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**Hugo Partials/Templates Used**:
- `candidates/warrior-directory.html`

### `layouts/_default/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/baseof.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**Hugo Partials/Templates Used**:
- `firebase-init.html`
- `floating-auth.html`
- `head.html`
- `site-scripts.html`

**HTML Stylesheet Hrefs**:
- `{{ $tailwind.RelPermalink }}`

### `layouts/_default/list.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/_default/onthemeupdate.md`

**Summary**: # onthemeupdate.md ## Project: This Is US (Hugo + PaperMod) --- ## Theme Strategy ## Current Overrides

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
- `document`
- `firebase`

### `layouts/shortcodes/candidates-list.html`

**Summary**: (no summary)

**Definitions**:
- `await`
- `candidateList`
- `encodeURIComponent`
- `window`

### `layouts/login/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/admin/users.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**HTML Script Sources**:
- `/js/admin-users.js`

### `layouts/admin/threads.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**HTML Script Sources**:
- `/js/admin-threads.js`

### `layouts/ballot/list.html`

**Summary**: // 🌐 Dynamic API base

**Definitions**:
- `await`
- `document`
- `location`

### `layouts/ballot/index.html`

**Summary**: // Step 1: Fetch sources from your D1 // Step 2: Pass sources to AI // Step 3: Render result

**Definitions**:
- `await`
- `document`

### `layouts/section/townhall.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/account/single.html`

**Summary**: (no summary)

**Definitions**:
- `document`

**HTML Script Sources**:
- `/js/account.js`

### `layouts/sandbox/single.html`

**Summary**: (no summary)

**Definitions**:
- `await`
- `sandboxGate`
- `window`

### `layouts/sandbox/interactive.html`

**Summary**: (no summary)

**Definitions**:
- `await`
- `firebase`
- `sandboxFlow`
- `window`

**HTML Script Sources**:
- `https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js`

### `layouts/events/single.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/events/create.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**Hugo Partials/Templates Used**:
- `event-form.html`
- `firebase-init.html`

**HTML Script Sources**:
- `/js/events/index.js`

### `layouts/events/section.html`

**Summary**: (no summary)

**Definitions**:
- `er`

**Hugo Partials/Templates Used**:
- `events/map-controls.html`
- `head.html`

**HTML Script Sources**:
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- `{{ `

**HTML Stylesheet Hrefs**:
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- `{{ `

### `layouts/events/hub.html`

**Summary**: (no summary)

**Definitions**:
- `er`

**Hugo Partials/Templates Used**:
- `events/map-controls.html`
- `head.html`

**HTML Script Sources**:
- `https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js`
- `{{ `

**HTML Stylesheet Hrefs**:
- `https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css`

### `layouts/candidates/list.html`

**Summary**: (no summary)

**Definitions**:
- `await`
- `candidateList`
- `encodeURIComponent`
- `window`

### `layouts/candidates/upload.html`

**Summary**: // Ensure clean API base — avoids double `/api/api/...`

**Definitions**:
- `await`
- `document`
- `json`
- `new`
- `uploadForm`
- `window`

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

**HTML Script Sources**:
- `/js/townhall/thread-view.js`

### `layouts/townhall/create.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/townhall/threads.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**HTML Script Sources**:
- `/js/townhall/threads.js`

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

**Hugo Partials/Templates Used**:
- `social_icons.html`

### `layouts/partials/extend_head.html`

**Summary**: (no summary)

**Definitions**:
- `er`

**HTML Script Sources**:
- `/js/firebase-auth-guard.js`
- `https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js`
- `https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js`
- `https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js`
- `https://cdn.tailwindcss.com`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- `{{ `

**HTML Stylesheet Hrefs**:
- `https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css`
- `https://fonts.googleapis.com/css2?family=Your+Font:wght@400;700&display=swap`
- `https://fonts.googleapis.com/icon?family=Material+Icons`
- `https://fonts.gstatic.com`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- `{{ `

### `layouts/partials/footer.html`

**Summary**: // td containing LineNos // table containing LineNos and code // code blocks not having highlight as parent class

**Definitions**:
- `codeblock`
- `copyingDone`
- `document`
- `this`
- `window`

### `layouts/partials/site-scripts.html`

**Summary**: (no summary)

**Definitions**:
- `location`

**HTML Script Sources**:
- `/js/firebase-config.js`
- `/js/firebase-login.js`
- `/js/firebase-session.js`
- `/js/townhall/create.js`
- `/js/townhall/home.js`
- `/js/townhall/map.js`
- `/js/townhall/threads.js`

### `layouts/partials/event-card.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `layouts/partials/firebase-init.html`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**HTML Script Sources**:
- `/js/firebase-config.js`
- `/js/firebase-idle-logout.js`
- `/js/firebase-login.js`
- `/js/firebase-session.js`
- `/js/firebase-ui-config.js`
- `https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js`
- `https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js`
- `https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js`
- `https://www.gstatic.com/firebasejs/ui/4.8.0/firebase-ui-auth.js`

**HTML Stylesheet Hrefs**:
- `https://www.gstatic.com/firebasejs/ui/4.8.0/firebase-ui-auth.css`

### `layouts/partials/floating-auth.html`

**Summary**: // Check Firebase loaded // Defer until FirebaseAuth is stable

**Definitions**:
- `document`
- `encodeURIComponent`

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

**Summary**: #theme-toggle, --theme: rgb(29, 30, 32); --entry: rgb(46, 46, 51); --primary: rgb(218, 218, 219); --secondary: rgb(155, 156, 157);

**Definitions**:
- `(no defs)`

**HTML Script Sources**:
- `{{ $search.RelPermalink }}`

**HTML Stylesheet Hrefs**:
- `../index.json`
- `{{ $stylesheet.RelPermalink }}`
- `{{ .Permalink | safeURL }}`
- `{{ .Permalink }}`
- `{{ if .Params.canonicalURL -}} {{ trim .Params.canonicalURL `
- `{{ site.Params.assets.apple_touch_icon | default `
- `{{ site.Params.assets.favicon | default `
- `{{ site.Params.assets.favicon16x16 | default `
- `{{ site.Params.assets.favicon32x32 | default `
- `{{ site.Params.assets.safari_pinned_tab | default `

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
- `await`
- `candidateList`
- `encodeURIComponent`
- `window`

### `content/donate.md`

**Summary**: --- --- /* full‑screen layout */ /* disclaimer */ #disclaimer { padding:2rem; font-size:1rem; line-height:1.5; }

**Definitions**:
- `(no defs)`

### `content/manifesto.md`

**Summary**: --- --- ## Introduction: Alarm ## I. Preamble: A Line in the Sand ### September 2024 and the Rise of Authoritarianism

**Definitions**:
- `(no defs)`

### `content/volunteer.md`

**Summary**: --- --- --- --- ## 🔊 Outreach & Field Operations

**Definitions**:
- `(no defs)`

### `content/credits.md`

**Summary**: --- --- # 🙏 Credits & Transparency --- ## 🤖 AI Assistance

**Definitions**:
- `(no defs)`

### `content/podcast.md`

**Summary**: --- --- ## This Is US Podcast

**Definitions**:
- `(no defs)`

### `content/_index.md`

**Summary**: --- --- --- ## 🔍 Our Mission ---

**Definitions**:
- `(no defs)`

### `content/about.md`

**Summary**: --- --- ## Why We Exist ## The Approach ## Our Foundation: Critical Thinking in Perilous Times

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

**Summary**: --- --- # Be Seen. Be Trusted. Be Part of Something Bigger Than Politics. ## Why Be Listed on This-Is-Us.org? ---

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
- `0`
- `async`
- `ault`
- `await`
- `btn`
- `db`
- `doc`
- `document`
- `firebase`
- `sortSelect`

### `static/js/firebase-auth-guard.js`

**Summary**: // /static/js/firebase-auth-guard.js // Paths that require a logged-in user // Wait until Firebase is ready // Optional: scroll to top for UX polish // Redirect to login page with original page as query param

**Definitions**:
- `encodeURIComponent`
- `normalizePath`
- `path`
- `protectedPaths`

### `static/js/events.js`

**Summary**: // Cleaned events.js

**Definitions**:
- `(no defs)`

### `static/js/townhall.js`

**Summary**: // static/js/townhall.js // Handles Firebase-authenticated Town Hall posts via Cloudflare D1 and R2 // 🧠 Personalize prompt

**Definitions**:
- `await`
- `document`
- `fileInput`
- `firebase`
- `input`
- `new`
- `prependResponse`
- `user`
- `window`

### `static/js/thread-replies.js`

**Summary**: // /static/js/thread-replies.js // Attach replies UI under each thread (after threads are rendered) // Load existing replies // Wait for threads to be rendered before attaching

**Definitions**:
- `async`
- `await`
- `card`
- `db`
- `doc`
- `document`
- `firebase`
- `form`
- `new`
- `repliesWrapper`
- `replyFormTemplate`
- `textarea`
- `threadList`
- `userDoc`

### `static/js/account.js`

**Summary**: // Logic for populating and updating the /account/ page with Firebase authentication and Firestore // Pre-fill form // Set global role for admin UI detection // Save handler // Delete handler

**Definitions**:
- `await`
- `confirm`
- `db`
- `document`
- `firebase`
- `showFeedback`

### `static/js/firebase-session.js`

**Summary**: // static/js/firebase-session.js // 🔓 Optional logout button logic

**Definitions**:
- `await`
- `db`
- `doc`
- `document`
- `firebase`

### `static/js/firebase-idle-logout.js`

**Summary**: // static/js/firebase-idle-logout.js // User activity events to reset timer

**Definitions**:
- `30`

### `static/js/event-list.js`

**Summary**: (no summary)

**Definitions**:
- `await`
- `document`

### `static/js/firebase-ui-config.js`

**Summary**: // Delay to ensure auth state is synced

**Definitions**:
- `authResult`
- `firebase`
- `new`
- `params`

### `static/js/firebase-config.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `static/js/reply-form.js`

**Summary**: // static/js/reply-form.js

**Definitions**:
- `document`
- `firebase`
- `form`

### `static/js/firebase-login.js`

**Summary**: // static/js/firebase-login.js

**Definitions**:
- `authResult`
- `document`
- `firebase`
- `new`

### `static/js/admin-users.js`

**Summary**: // static/js/admin-users.js // Initial render // Search filter

**Definitions**:
- `await`
- `btn`
- `currentRole`
- `currentUserDoc`
- `db`
- `document`
- `e`
- `firebase`
- `renderTable`
- `usersData`

### `static/js/leafletzipsearch.js`

**Summary**: // Autofill workaround: detect changes periodically

**Definitions**:
- `L`
- `await`
- `document`
- `input`

**Imports/Exports**:
- `export createZipSearchBox`

### `static/js/utils/safe-fetch.js`

**Summary**: // network‐OK but HTTP error // non‐JSON error payload // success path: parse JSON (or return text if you prefer) // rethrow so callers can catch, or let global unhandledRejection fire

**Definitions**:
- `await`

**Imports/Exports**:
- `export async`

### `static/js/utils/parse-latlng.js`

**Summary**: // static/js/utils/parse-latlng.js /**

**Definitions**:
- `typeof`

**Imports/Exports**:
- `export parseLatLng`

### `static/js/events/ui-feedback.js`

**Summary**: // —————————————————————————————————————————— // Simple DOM selector // —————————————————————————————————————————— /** // ——————————————————————————————————————————

**Definitions**:
- `document`
- `input`
- `typeof`

**Imports/Exports**:
- `export bindPdfPreview`
- `export showError`
- `export showSuccess`
- `export showSuccessModal`
- `export showToast`
- `export toggleLoading`

### `static/js/events/event-map.js`

**Summary**: // static/js/events/event-map.js // —————————————————————————————————————————— // Simple selector // —————————————————————————————————————————— // ——————————————————————————————————————————

**Definitions**:
- `4`
- `L`
- `await`
- `input`
- `mapSelector`
- `setMarker`

**Imports/Exports**:
- `export bindAddressSearch`
- `export initMap`
- `import './ui-feedback.js'`

### `static/js/events/event-form.js`

**Summary**: // static/js/events/event-form.js /** // 1) PDF size guard // 2) Hide success modal initially // 3) Prevent past dates

**Definitions**:
- `5`
- `bindConfirm`
- `bindFormLogic`
- `document`
- `fileInput`
- `handlePreview`
- `new`
- `resetForm`
- `wrapper`

**Imports/Exports**:
- `export renderForm`
- `import './event-map.js'`
- `import './preview-renderer.js'`
- `import './submit-event.js'`
- `import './ui-feedback.js'`
- `import './validation-utils.js'`

### `static/js/events/validation-utils.js`

**Summary**: // validation-utils.js — Reusable field validation utilities

**Definitions**:
- `new`

**Imports/Exports**:
- `export areRequiredFieldsPresent`
- `export isFutureDate`
- `export isValidEmail`
- `export isValidPhone`

### `static/js/events/preview-renderer.js`

**Summary**: // static/js/events/preview-renderer.js /** // Normalize keys // Format date // PDF URL

**Definitions**:
- `data`
- `document`
- `file`
- `rawDate`

**Imports/Exports**:
- `export renderPreview`

### `static/js/events/index.js`

**Summary**: // static/js/events/index.js /** // Show the form: remove hidden, add flex-layout classes // Hide the form: add hidden, remove flex-layout classes

**Definitions**:
- `document`

**Imports/Exports**:
- `import './event-form.js'`

### `static/js/events/events-discover.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `static/js/events/submit-event.js`

**Summary**: // static/js/events/submit-event.js // —————————————————————————————————————————— // Configuration // —————————————————————————————————————————— /**

**Definitions**:
- `await`
- `getUserFriendlyError`
- `new`

**Imports/Exports**:
- `export async`
- `import '../utils/safe-fetch.js'`
- `import './error-manager.js'`

### `static/js/events/form-state.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `export collectFormData`

### `static/js/events/populate-map.js`

**Summary**: // static/js/events/populate-map.js /**

**Definitions**:
- `L`
- `await`

**Imports/Exports**:
- `export async`

### `static/js/events/error-manager.js`

**Summary**: // static/js/events/error-manager.js /**

**Definitions**:
- `ault`

**Imports/Exports**:
- `export getUserFriendlyError`

### `static/js/events/hub.js`

**Summary**: // static/js/events/hub.js

**Definitions**:
- `0`
- `await`
- `document`
- `lat`
- `lng`
- `mapEl`
- `markerCache`
- `new`
- `zipInput`

**Imports/Exports**:
- `import '../utils/parse-latlng.js'`
- `import '../utils/safe-fetch.js'`
- `import './ui-feedback.js'`

### `static/js/townhall/threads.js`

**Summary**: /* --------------------------------------------------------- --------------------------------------------------------- */ /* ── Render one thread doc into a card ───────────────────────── */ /* ── Fetch next page of threads ──────────────────────────────── */ /* ── Infinite scroll sentinel ───────────────────────────────── */

**Definitions**:
- `15`
- `await`
- `card`
- `db`
- `doc`
- `document`
- `e`
- `encodeURIComponent`
- `false`
- `firebase`
- `null`
- `renderCard`
- `t`

### `static/js/townhall/active.js`

**Summary**: // /static/js/townhall/active.js // Placeholder for future 'active threads' logic

**Definitions**:
- `(no defs)`

### `static/js/townhall/home.js`

**Summary**: /* --------------------------------------------------------- --------------------------------------------------------- */ /* 1️⃣  FIREBASE READY ---------------------------------------------------- */ /* 2️⃣  UI BOOT ----------------------------------------------------------- */ /* --- Tabs -------------------------------------------------------------- */

**Definitions**:
- `attachFAB`
- `attachLocationControls`
- `attachTabs`
- `await`
- `btn`
- `doc`
- `document`
- `encodeURIComponent`
- `getUserLocation`
- `initUI`
- `renderThreads`
- `showMap`

### `static/js/townhall/thread-view.js`

**Summary**: /* ────────────────────────────────────────────────────────────── // Firestore collection helpers // Extract threadId from query string or path // Subscribe to thread document // Render thread + reply-list + form

**Definitions**:
- `doc`
- `document`
- `el`
- `firebase`
- `form`
- `id`
- `new`
- `null`
- `qs`
- `renderReplies`
- `renderSkeleton`
- `renderThreadHTML`
- `showError`
- `str`
- `ts`
- `wireReplyForm`
- `wrap`

### `static/js/townhall/create.js`

**Summary**: /*  static/js/townhall/create.js /* ── Firebase guard ─────────────────────────────────────── */ /* ── Submit handler ─────────────────────────────────────── */ /* Optional: quick geolocation for marker accuracy */

**Definitions**:
- `await`
- `document`
- `firebase`
- `form`
- `null`

### `static/js/townhall/map.js`

**Summary**: /* ────────────────────────────────────────────────────────────── /* helper -------------------------------------------------- */ /* 0 • pre-flight ----------------------------------------- */ /* 1 • map ------------------------------------------------- */ /* 2 • cluster layer (load plugin once on-demand) ---------- */

**Definitions**:
- `L`
- `await`
- `doc`
- `document`
- `firebase`
- `map`

### `firebase-seeder/patch-giscus-urls.js`

**Summary**: // firebase-seeder/patch-giscus-urls.js // Authenticated GitHub clients // 🔎 Fetch all discussions from the repo

**Definitions**:
- `0`
- `admin`
- `await`
- `discussions`
- `doc`
- `graphql`
- `new`
- `process`
- `require`

**Imports/Exports**:
- `export GITHUB_TOKEN`
- `require('../firebase-seeder/serviceAccountKey.json')`
- `require('@octokit/graphql')`
- `require('@octokit/rest')`
- `require('dotenv')`
- `require('firebase-admin')`

### `firebase-seeder/check-giscus-urls.js`

**Summary**: (no summary)

**Definitions**:
- `admin`
- `await`
- `doc`
- `require`

**Imports/Exports**:
- `require('../firebase-seeder/serviceAccountKey.json')`
- `require('firebase-admin')`

### `firebase-seeder/full-reset-seeder.js`

**Summary**: // firebase-seeder/full-reset-seeder.js // Wipe + re-seed Firestore and Giscus threads // Config // Ensure token is set // ─── UTILITIES ─────────────────────────────────────────────

**Definitions**:
- `admin`
- `await`
- `db`
- `new`
- `process`
- `require`

**Imports/Exports**:
- `require('./serviceAccountKey.json')`
- `require('@octokit/rest')`
- `require('firebase-admin')`

### `firebase-seeder/seed.js`

**Summary**: // firebase-seeder/seed.js // Seeds townhall_threads with coordinates

**Definitions**:
- `admin`
- `db`
- `require`

**Imports/Exports**:
- `require('./serviceAccountKey.json')`
- `require('firebase-admin')`

### `archetypes/default.md`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `archive_content/podcast.md`

**Summary**: --- --- ## 🎧 This Is Us: On the Other Side of Fear

**Definitions**:
- `(no defs)`

### `archive_content/_index.md`

**Summary**: --- --- --- # This is US ---

**Definitions**:
- `(no defs)`

### `archive_content/events.md`

**Summary**: --- --- ## Upcoming Events ### 🎓 Voices for Democracy Workshop ---

**Definitions**:
- `(no defs)`

### `archive_content/about.md`

**Summary**: --- --- ## Why We Exist ### We Oppose: ### We Support:

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
- `await`
- `new`
- `url`

**Imports/Exports**:
- `export default`
- `import '../tools/getCandidatePdf.js'`
- `import '../tools/insertParsedCandidate.js'`
- `import '../tools/listCandidates.js'`
- `import '../tools/parseCandidatePdf.js'`
- `import '../tools/processCandidateUpload.js'`
- `import '../tools/subscribeToAlerts.js'`
- `import '../tools/warrior.mjs'`
- `import './routes/candidate-confirm.js'`
- `import './routes/candidate-file.js'`
- `import './routes/candidate-upload.js'`

### `mcp/src/routes/candidate-upload.js`

**Summary**: // src/routes/candidate-upload.js // Generate a unique key for the PDF // Build the public URL for retrieving the PDF // Return both the raw key and the public URL

**Definitions**:
- `await`
- `form`
- `new`

**Imports/Exports**:
- `export async`

### `mcp/src/routes/candidate-file.js`

**Summary**: // mcp/src/routes/candidate-file.js // Attempt to fetch the PDF from R2 // Stream back the PDF with proper headers // Inline display; change to "attachment" to force download // Prevent caching on the client

**Definitions**:
- `await`
- `new`
- `segments`
- `url`

**Imports/Exports**:
- `export async`

### `mcp/src/routes/candidate-confirm.js`

**Summary**: // mcp/src/routes/candidate-confirm.js // Parse and log incoming payload // Validate // Compute the public URL for the PDF // Insert into D1 and retrieve new record ID

**Definitions**:
- `await`
- `insert`
- `new`

**Imports/Exports**:
- `export async`

### `mcp/migrations/0003_add_candidates_table.sql`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

### `mcp/tools/subscribeToAlerts.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `export async`

### `mcp/tools/listCandidates.js`

**Summary**: (no summary)

**Definitions**:
- `location`

**Imports/Exports**:
- `export async`

### `mcp/tools/parseCandidatePdf.js`

**Summary**: // mcp/tools/parseCandidatePdf.js // 🧩 Extract key from the URL // 📂 Load PDF from R2 // 🧠 Run LLM model // 🧪 Use .text or .response fallback

**Definitions**:
- `aiResponse`
- `await`
- `btoa`
- `pdf_url`
- `text`

**Imports/Exports**:
- `export async`

### `mcp/tools/warrior.mjs`

**Summary**: // mcp/src/tools/warrior.mjs // Use D1 to fetch by location (case-insensitive partial match) // Ensure pdf_url is populated

**Definitions**:
- `env`

**Imports/Exports**:
- `export async`

### `mcp/tools/insertParsedCandidate.js`

**Summary**: // mcp/tools/insertParsedCandidate.js

**Definitions**:
- `env`

**Imports/Exports**:
- `export async`

### `mcp/tools/getCandidatePdf.js`

**Summary**: (no summary)

**Definitions**:
- `(no defs)`

**Imports/Exports**:
- `export async`

### `mcp/tools/processCandidateUpload.js`

**Summary**: // mcp/tools/processCandidateUpload.js // Step 1: Parse the PDF // Step 2: Insert parsed candidate // 🎉 All good

**Definitions**:
- `await`

**Imports/Exports**:
- `export async`
- `import './insertParsedCandidate.js'`
- `import './parseCandidatePdf.js'`

## 🔍 Town Hall Debug Audit

### Layout templates

- `layouts/townhall/list.html` – [31m❌ missing[0m
- `layouts/townhall/thread.html` – [31m❌ missing[0m
- `layouts/townhall/create.html` – [32m✅ found[0m
- `layouts/section/townhall.html` – [32m✅ found[0m

### Critical JS files

- `static/js/townhall/home.js` – [32m✅ found[0m
- `static/js/townhall/threads.js` – [32m✅ found[0m
- `static/js/townhall/thread-view.js` – [32m✅ found[0m

### Thread front‑matter sanity

- `content/townhall/thread/index.md` → [33missues: slug, lat, lon[0m

## 🌐 API Endpoints Found

[33mNo API endpoints detected in worker directories.[0m

## 📄 Hugo Template Usage

- `candidates/warrior-directory.html` called in `layouts/_default/candidates-single.html`
- `event-form.html` called in `layouts/events/create.html`
- `events/map-controls.html` called in `layouts/events/hub.html`
- `events/map-controls.html` called in `layouts/events/section.html`
- `firebase-init.html` called in `layouts/_default/baseof.html`
- `firebase-init.html` called in `layouts/events/create.html`
- `floating-auth.html` called in `layouts/_default/baseof.html`
- `head.html` called in `layouts/_default/baseof.html`
- `head.html` called in `layouts/events/hub.html`
- `head.html` called in `layouts/events/section.html`
- `site-scripts.html` called in `layouts/_default/baseof.html`
- `social_icons.html` called in `layouts/partials/home_info.html`

## 🔗 External JavaScript Includes

- `/js/account.js` in `layouts/account/single.html`
- `/js/admin-threads.js` in `layouts/admin/threads.html`
- `/js/admin-users.js` in `layouts/admin/users.html`
- `/js/events/index.js` in `layouts/events/create.html`
- `/js/firebase-auth-guard.js` in `layouts/partials/extend_head.html`
- `/js/firebase-config.js` in `layouts/partials/firebase-init.html`
- `/js/firebase-config.js` in `layouts/partials/site-scripts.html`
- `/js/firebase-idle-logout.js` in `layouts/partials/firebase-init.html`
- `/js/firebase-login.js` in `layouts/partials/firebase-init.html`
- `/js/firebase-login.js` in `layouts/partials/site-scripts.html`
- `/js/firebase-session.js` in `layouts/partials/firebase-init.html`
- `/js/firebase-session.js` in `layouts/partials/site-scripts.html`
- `/js/firebase-ui-config.js` in `layouts/partials/firebase-init.html`
- `/js/townhall/create.js` in `layouts/partials/site-scripts.html`
- `/js/townhall/home.js` in `layouts/partials/site-scripts.html`
- `/js/townhall/map.js` in `layouts/partials/site-scripts.html`
- `/js/townhall/thread-view.js` in `layouts/townhall/single.html`
- `/js/townhall/threads.js` in `layouts/partials/site-scripts.html`
- `/js/townhall/threads.js` in `layouts/townhall/threads.html`
- `https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js` in `layouts/partials/extend_head.html`
- `https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js` in `layouts/sandbox/interactive.html`
- `https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js` in `layouts/partials/extend_head.html`
- `https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js` in `layouts/events/hub.html`
- `https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js` in `layouts/partials/extend_head.html`
- `https://cdn.tailwindcss.com` in `layouts/partials/extend_head.html`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js` in `layouts/partials/extend_head.html`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` in `layouts/events/section.html`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` in `layouts/partials/extend_head.html`
- `https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js` in `layouts/partials/firebase-init.html`
- `https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js` in `layouts/partials/firebase-init.html`
- `https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js` in `layouts/partials/firebase-init.html`
- `https://www.gstatic.com/firebasejs/ui/4.8.0/firebase-ui-auth.js` in `layouts/partials/firebase-init.html`
- `{{ $search.RelPermalink }}` in `layouts/partials/head.html`
- `{{ ` in `layouts/events/hub.html`
- `{{ ` in `layouts/events/section.html`
- `{{ ` in `layouts/partials/extend_head.html`

## 🎨 External Stylesheet Includes

- `../index.json` in `layouts/partials/head.html`
- `https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css` in `layouts/events/hub.html`
- `https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css` in `layouts/partials/extend_head.html`
- `https://fonts.googleapis.com/css2?family=Your+Font:wght@400;700&display=swap` in `layouts/partials/extend_head.html`
- `https://fonts.googleapis.com/icon?family=Material+Icons` in `layouts/partials/extend_head.html`
- `https://fonts.gstatic.com` in `layouts/partials/extend_head.html`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css` in `layouts/partials/extend_head.html`
- `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css` in `layouts/partials/extend_head.html`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` in `layouts/events/section.html`
- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` in `layouts/partials/extend_head.html`
- `https://www.gstatic.com/firebasejs/ui/4.8.0/firebase-ui-auth.css` in `layouts/partials/firebase-init.html`
- `{{ $stylesheet.RelPermalink }}` in `layouts/partials/head.html`
- `{{ $tailwind.RelPermalink }}` in `layouts/_default/baseof.html`
- `{{ .Permalink | safeURL }}` in `layouts/partials/head.html`
- `{{ .Permalink }}` in `layouts/partials/head.html`
- `{{ ` in `layouts/events/section.html`
- `{{ ` in `layouts/partials/extend_head.html`
- `{{ if .Params.canonicalURL -}} {{ trim .Params.canonicalURL ` in `layouts/partials/head.html`
- `{{ site.Params.assets.apple_touch_icon | default ` in `layouts/partials/head.html`
- `{{ site.Params.assets.favicon | default ` in `layouts/partials/head.html`
- `{{ site.Params.assets.favicon16x16 | default ` in `layouts/partials/head.html`
- `{{ site.Params.assets.favicon32x32 | default ` in `layouts/partials/head.html`
- `{{ site.Params.assets.safari_pinned_tab | default ` in `layouts/partials/head.html`
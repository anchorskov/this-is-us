// README.md

# This Is Us – Project Overview

Welcome to the development workspace for [this-is-us.org](https://this-is-us.org). This project is focused on empowering civic unity and engagement through transparent, accessible technology. Our goals are to:

- Build a dynamic, community-driven website
- Integrate Firebase Authentication and Firestore
- Develop a geolocation-aware Town Hall feature
- Ensure clear UX across devices
- Maintain a culture of integrity, accountability, transparency, and compassion

## Folder Overview

### Active Project Sections (Tree Overview - `tree -L 2`)

```
.
├── _dev/               # In-progress work, zip archives, reviews, stubs
├── archetypes/         # Hugo default archetypes
├── archive_content/    # Retired content pages
├── assets/             # CSS and theme-related assets
├── ballots/            # Voting tools and ballot generators
├── content/            # Hugo content structure (markdown)
├── data/               # SQL schema and seed files
├── firebase/           # Config, rules, indexes
├── layouts/            # Hugo layout templates
├── mcp/                # Candidate PDF processing tools and worker config
├── scripts/            # Firebase auth, post UI, and helper scripts
├── static/             # Static assets (JS, CSS, PDFs)
├── tests/              # Python tests for events API
├── themes/             # Hugo theme (PaperMod)
├── townhall/           # Map UI, threads, forms, geo filters, worker API
├── worker/             # Cloudflare Workers code, D1, and migration scripts
```

---

## 📂 Logic Overview by Folder & Key Files

### `layouts/`
- `layouts/index.html` – Homepage structure and main blocks
- `layouts/partials/site-scripts.html` – Global script loading and Firebase logic injection
- `layouts/townhall/list.html` – Displays townhall threads with location-aware filters

### `scripts/`
- `static/js/firebase-auth.js` – Handles login/logout, auth listener, redirects
- `static/js/floating-auth.js` – Replaces modal auth with UI overlay
- `static/js/events-create.js` – Gathers and sends form data to Firebase
- `static/js/map-init.js` – Renders pins using Leaflet or Google Maps

### `firebase/`
- `firebase.json` – Project and deploy settings
- `firestore.rules` – Role-based read/write validation
- `firestore.indexes.json` – Compound indexes for townhall queries

### `townhall/`
- `layouts/townhall/section.html` – Core map UI
- `content/townhall/_index.md` – Explains the feature to users
- `worker/src/townhall/create.js` – Accepts new post via API
- `worker/src/townhall/list.js` – Returns location-specific threads

### `mcp/`
- `tools/parseCandidatePdf.js` – Extracts structured data from uploaded PDFs
- `tools/insertParsedCandidate.js` – Saves candidate info to D1
- `src/routes/candidate-upload.js` – API to receive PDF, return validation

### `worker/`
- `src/index.mjs` – Route handler for all worker logic
- `src/townhall/*.js` – All D1 operations (CRUD)
- `migrations/*.sql` – D1 table setup and field extensions

---
## 🚑 Debugging the Town Hall feature

1. **Run the audit**  
   ```bash
   python summarize-logic.py --townhall-only --output -

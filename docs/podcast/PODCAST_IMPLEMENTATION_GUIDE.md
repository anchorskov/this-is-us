# Podcast Implementation Summary

## Overview
The podcast feature enables playback of MP3 audio files from Cloudflare R2 and displays episode summaries fetched from D1 database via a Worker API endpoint. The implementation includes an audio player, summary modal, and environment-aware API routing for both local development and production.

---

## Recent Changes

### 1. **content/podcast.md** – Updated Page Structure
- **Title & Intro**: Changed to "JR Riggins on Service, Policy, and Civic Responsibility"
- **Subtitle**: "A conversation with JR Riggins covering civic participation, policy, and the work behind the scenes."
- **Episode Structure**: Three parts for the JR Riggins interview (December 14, 2025)
  - Each part uses audio shortcode: `{{< audio src="podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3" title="Listen" >}}`
  - Clean summary button blocks with **no inline styles** (styling moved to custom.css)
  - Data attributes: `data-guest`, `data-date`, `data-part` (no `data-target` anymore)
  - Script loaded once at bottom: `<script src="/js/podcast-summary.js"></script>`

### 2. **static/js/podcast-summary.js** – Modal-Based Summary Fetcher
**Key Features:**
- **Modal Implementation**: Creates a modal dialog dynamically when needed (single modal reused across all buttons)
- **Backdrop & Close Button**: Click backdrop or × button to close modal
- **Environment Detection**: 
  - **Local** (`localhost` or `127.0.0.1`): Uses `/api` (routes to Wrangler on 8787)
  - **Production** (all other hosts): Uses `https://this-is-us-events.anchorskov.workers.dev/api` (absolute Worker domain)
- **Error Handling**: 
  - 404 → "Summary not available."
  - Network/parse errors → "Could not load summary."
- **Button State**: Restores original button text after load completes

**API Call Pattern:**
```javascript
// Example:
GET /api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1
// Returns: { summary: "...", ... }
```

### 3. **static/css/custom.css** – Podcast Styles
**Button Styling** (`.podcast-summary-btn`):
- Background: `#b5e48c` (light green)
- Text: `#0f2a10` (dark green)
- Border: `1px solid #8bcf6d`
- Padding: `0.5em 1em`
- Hover: Slight brightness reduction (0.97x)

**Modal Styling** (`.podcast-summary-modal*`):
- **Backdrop**: Full-screen semi-transparent overlay (`rgba(0,0,0,0.45)`)
- **Dialog**: Centered box with theme colors, max-width 600px, 90% on mobile
- **Header**: Title + close button (×) in flexbox
- **Body**: Left-aligned text with 1.5 line-height for readability
- **Z-index**: Modal at 2000 (well above other content)

---

## How It Works

### Local Development Flow
1. User opens http://127.0.0.1:1313/podcast/
2. Audio player loads (HTML5 `<audio>` from R2)
3. User clicks "Show summary" button
4. JavaScript detects `localhost` → uses `/api`
5. Fetch to `http://127.0.0.1:8787/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1`
6. Wrangler Worker queries D1 and returns summary
7. Modal pops up with summary text

### Production Flow
1. User opens https://this-is-us.org/podcast/
2. Audio player loads (HTML5 `<audio>` from R2)
3. User clicks "Show summary" button
4. JavaScript detects production hostname → uses absolute Worker domain
5. Fetch to `https://this-is-us-events.anchorskov.workers.dev/api/podcast/summary?...`
6. Cloudflare Worker queries D1 and returns summary
7. Modal pops up with summary text

**Key Advantage**: Bypasses Cloudflare Pages routing issues by calling the Worker directly.

---

## Testing in WSL

### Setup
```bash
cd /home/anchor/projects/this-is-us
./start_local.sh &
```
Wait for the output: `Start building sites …` and `Environment: "development"` to confirm both Hugo and Wrangler are running.

### Test Steps

#### 1. **Audio Playback**
- Open http://127.0.0.1:1313/podcast/
- Verify page title: "JR Riggins on Service, Policy, and Civic Responsibility"
- Verify three audio players appear (one per part)
- Each player shows: Play button, timeline, volume control, duration (e.g., "15:35")
- Click Play → audio should play from R2 (media.this-is-us.org)
- Seek/pause/resume should work

#### 2. **Summary Modal**
- Click "Show summary" button under Part 1
- Modal should appear with:
  - Title: "Summary"
  - Body: Episode summary text (fetched from D1)
  - Close button (×) in top-right
  - Semi-transparent dark backdrop
- Verify console shows: `📄 Fetching static summary from: http://127.0.0.1:8787/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1`
- Click × or backdrop to close modal

#### 3. **Button Styling**
- Verify buttons have light green background (#b5e48c) and dark green text
- Hover over button → should appear slightly darker
- Verify button is disabled during "Loading summary..." state
- Button text restored after load completes

#### 4. **Error Handling**
- Stop Wrangler (`Ctrl+C` in the terminal running `start_local.sh`)
- Click "Show summary" again
- Modal should show: "Could not load summary."
- Check console for error message
- Restart Wrangler to confirm it recovers

#### 5. **Download Links**
- Each audio player should have a "Download" link
- Click download → MP3 file should download from R2

### Expected Behavior Summary
| Action | Local | Production |
|--------|-------|------------|
| Audio plays | ✅ From R2 | ✅ From R2 |
| Summary fetches | ✅ Via `/api` → Wrangler | ✅ Via Worker domain |
| Modal appears | ✅ Yes | ✅ Yes |
| Button styling | ✅ Green (#b5e48c) | ✅ Green (#b5e48c) |
| Closes on click | ✅ Yes | ✅ Yes |

---

## Remote Testing (https://this-is-us.org)

After deploying, test the same steps above. The behavior should be **identical** because the JavaScript automatically switches to the absolute Worker domain URL on production:

```javascript
// On production, this line returns:
// https://this-is-us-events.anchorskov.workers.dev/api/podcast/summary?...
const apiUrl = getApiUrl();
```

No Pages routing issues → summaries load consistently.

---

## Files Modified

| File | Changes |
|------|---------|
| `content/podcast.md` | Title, intro, episode structure, no inline button styles, cleaner HTML |
| `static/js/podcast-summary.js` | Modal implementation, environment-aware API routing, error handling |
| `static/css/custom.css` | Button & modal styles (`.podcast-summary-*` classes) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ content/podcast.md                                      │
│ - Three audio players (R2 links)                        │
│ - Three "Show summary" buttons                          │
│ - Loads podcast-summary.js at bottom                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├──> Load: podcast-summary.js
                   │    ├─ Detect environment (local/prod)
                   │    ├─ Set API base URL
                   │    └─ Add click handlers to all buttons
                   │
                   ├──> On button click:
                   │    ├─ Create modal (if needed)
                   │    ├─ Fetch from D1 via API
                   │    └─ Show summary in modal
                   │
                   └──> Style with: custom.css
                        ├─ .podcast-summary-btn
                        ├─ .podcast-summary-modal
                        ├─ .podcast-summary-modal__backdrop
                        └─ .podcast-summary-modal__dialog

API Routing:
┌─ Local: /api → Wrangler (8787)
└─ Prod:  https://this-is-us-events.anchorskov.workers.dev/api
          → Cloudflare Worker → D1 query
```

---

## Notes

- **Static Summary Files**: Intentionally removed; summaries come from D1 for real-time updates
- **Modal UX**: Single modal reused across all buttons (efficient, cleaner DOM)
- **Accessibility**: Modal uses `role="dialog"`, `aria-modal="true"`, `aria-label` on close button
- **Error Messages**: User-friendly ("Summary not available." vs. "Could not load summary.")
- **Console Logging**: Check browser DevTools for fetch URLs and errors

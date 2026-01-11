# Podcast MP3 Playback Implementation

Complete implementation of Cloudflare R2 podcast streaming with Hugo shortcodes.

## Files Delivered

### 1. config.toml (Modified)
**Location:** `config.toml`
**Change:** Added mediaBaseUrl parameter to [params] section

```toml
[params]
  ...
  mediaBaseUrl = "https://media.this-is-us.org"
  ...
```

This single configuration parameter ensures all podcast URLs are environment-agnostic. Change this URL once to update all media references site-wide.

---

### 2. layouts/shortcodes/audio.html (Created)
**Location:** `layouts/shortcodes/audio.html`
**Purpose:** Reusable shortcode for embedding HTML5 audio players

**Features:**
- Supports relative paths (e.g., "podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3")
- Supports absolute paths (e.g., "/static/audio/file.mp3")
- Optional title display
- Optional download link (default: enabled)
- Automatic URL construction using mediaBaseUrl
- Error handling for missing required parameters

**Usage Examples:**
```markdown
{{< audio src="podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3" title="Part 1: Introduction" >}}

{{< audio src="podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3" title="Part 2: Core Topics" download="false" >}}

{{< audio src="/static/audio/local-file.mp3" title="Local File" >}}
```

**Parameters:**
- `src` (required): Audio file path
- `title` (optional): Display title
- `download` (optional): Show download link (true/false, default: true)

---

### 3. content/podcast.md (Modified)
**Location:** `content/podcast.md`
**Change:** Added JR Riggins Interview section with three audio players

**New Content:**
- Section heading: "JR Riggins Interview - December 14, 2025"
- Description paragraph
- Three subsections with audio players:
  - Part 1: Introduction & Background
  - Part 2: Core Discussion
  - Part 3: Insights & Conclusion

Each player points to:
```
podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3
podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3
podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-03.mp3
```

---

### 4. scripts/media/r2_upload_podcasts.sh (Created)
**Location:** `scripts/media/r2_upload_podcasts.sh`
**Purpose:** Bash script for uploading podcast MP3s to Cloudflare R2

**Features:**
- Strict bash mode: `set -euo pipefail`
- Validates ./scripts/wr and jq availability
- Validates input directory
- Uploads three MP3 files with proper metadata
- Sets Content-Type: audio/mpeg
- Sets Cache-Control: public, max-age=31536000, immutable
- Displays public URLs after upload
- Provides copy-paste shortcode examples

**Configuration (Environment Variables):**
```bash
BUCKET="podcasts"                                              # R2 bucket name (default)
DATE="2025-12-14"                                              # Date folder (default)
DIR="/home/anchor/projects/Media_Conversion/sound_files"       # Input directory (default)
MEDIA_BASE_URL="https://media.this-is-us.org"                  # Public domain (default)
R2_ENDPOINT=""                                                 # Optional R2 endpoint
```

**Usage:**
```bash
# Default usage (reads from /home/anchor/projects/Media_Conversion/sound_files/)
./scripts/media/r2_upload_podcasts.sh

# Custom bucket and date
BUCKET="archive" DATE="2025-01-01" ./scripts/media/r2_upload_podcasts.sh

# Custom input directory
DIR="/other/path/to/mp3/files" ./scripts/media/r2_upload_podcasts.sh
```

**Output:**
```
==========================================
Cloudflare R2 Podcast Upload Script
==========================================
...
[SUCCESS] Uploaded: jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3
[SUCCESS] Uploaded: jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3
[SUCCESS] Uploaded: jr-riggins/2025-12-14/JR_RIGGINS_-03.mp3

==========================================
Upload Complete - Public URLs:
==========================================
Part 1: https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3
Part 2: https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3
Part 3: https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-03.mp3
```

---

## Quick Start

### 1. Deploy Changes
```bash
cd /home/anchor/projects/this-is-us

# Verify Hugo builds
hugo

# Start local server
hugo server --buildDrafts
```

Visit http://localhost:1313/podcast/ to see the audio players.

### 2. Prepare Files
```bash
# Files should be in /home/anchor/projects/Media_Conversion/sound_files/
ls /home/anchor/projects/Media_Conversion/sound_files/JR_RIGGINS_-*.mp3
```

### 3. Upload to R2
```bash
# Ensure ./scripts/wr is configured and authenticated
./scripts/media/r2_upload_podcasts.sh
```

### 4. Verify
```bash
# Check R2 files have correct headers
curl -I https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3

# Expected response includes:
# Content-Type: audio/mpeg
# Cache-Control: public, max-age=31536000, immutable
# HTTP/2 200
```---

## Architecture

### URL Resolution
The audio shortcode implements smart URL resolution:

1. **Relative key paths** (e.g., "podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3"):
   - Prepended with `params.mediaBaseUrl`
   - Result: `https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3`

2. **Absolute paths** (e.g., "/static/audio/file.mp3"):
   - Prepended with Hugo's `baseURL`
   - Result: `https://this-is-us.org/static/audio/file.mp3`

### Cache Strategy
R2 files are uploaded with:
```
Cache-Control: public, max-age=31536000, immutable
```

This tells browsers to cache audio files for 1 year without revalidation. Safe for immutable content (podcast archives).

### Single Configuration Point
All media URLs flow through `config.toml`:
```toml
mediaBaseUrl = "https://media.this-is-us.org"
```

To change the media domain (e.g., CDN migration), update this single line.

---

## Testing

See `PODCAST_TEST_CHECKLIST.md` for comprehensive test procedures covering:
- Hugo site configuration
- Audio shortcode rendering
- Audio playback and seeking
- URL construction validation
- R2 upload script functionality
- Content-type and cache headers
- Responsive design
- Error handling

---

## Constraints Satisfied

- [x] File path comments added to every created/modified file
- [x] No em dashes used
- [x] Single mediaBaseUrl configuration parameter
- [x] Shortcode handles relative and absolute paths correctly
- [x] R2 upload script with proper headers and caching
- [x] Error handling and validation throughout
- [x] Environment-agnostic design

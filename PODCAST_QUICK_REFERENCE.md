# Podcast MP3 Playback - Quick Reference

## Files at a Glance

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `config.toml` | Modified | Added `mediaBaseUrl` | Single source for all media URLs |
| `layouts/shortcodes/audio.html` | Created | 55 lines | HTML5 audio player shortcode |
| `content/podcast.md` | Modified | Added JR Riggins section | 3 audio players for new episode |
| `scripts/media/r2_upload_podcasts.sh` | Created | 150 lines | Upload to Cloudflare R2 |
| `PODCAST_IMPLEMENTATION.md` | Created | 300 lines | Complete documentation |
| `PODCAST_TEST_CHECKLIST.md` | Created | 200+ lines | Testing procedures |

## Configuration

All media URLs controlled by single parameter:

```toml
# config.toml - [params] section
mediaBaseUrl = "https://media.this-is-us.org"
```

Change this once to update all podcast URLs.

## Shortcode Usage

```markdown
{{< audio src="podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3" title="Part 1" >}}
```

### Parameters

| Parameter | Required | Default | Example |
|-----------|----------|---------|---------|
| `src` | Yes | - | `podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3` |
| `title` | No | None | `"Part 1: Introduction"` |
| `download` | No | `true` | `"false"` |

### URL Resolution

- **Relative paths** (e.g., `podcasts/...`): Prepend `mediaBaseUrl`
  - Result: `https://media.this-is-us.org/podcasts/jr-riggins/...`

- **Absolute paths** (e.g., `/static/...`): Prepend Hugo `baseURL`
  - Result: `https://this-is-us.org/static/...`

## Upload Script

### Basic Usage

```bash
./scripts/media/r2_upload_podcasts.sh
```

Requires:
- Files in `/home/anchor/projects/Media_Conversion/sound_files/`: `JR_RIGGINS_-01.mp3`, `JR_RIGGINS_-02.mp3`, `JR_RIGGINS_-03.mp3`
- wrangler CLI authenticated
- jq installed

### Custom Configuration

```bash
# Different bucket and date
BUCKET="archive" DATE="2025-01-01" ./scripts/media/r2_upload_podcasts.sh

# Custom input directory
DIR="/path/to/files" ./scripts/media/r2_upload_podcasts.sh
```

### Environment Variables

```bash
BUCKET="podcasts"                                              # Default: podcasts
DATE="2025-12-14"                                              # Default: 2025-12-14
DIR="/home/anchor/projects/Media_Conversion/sound_files"       # Default path
MEDIA_BASE_URL="https://media.this-is-us.org"                  # Default: https://media.this-is-us.org
```

## R2 Upload Metadata

Files uploaded with:
```
Content-Type: audio/mpeg
Cache-Control: public, max-age=31536000, immutable
```

This caches files for 1 year without revalidation (safe for archived content).

## Testing

### Hugo Build
```bash
hugo
hugo server --buildDrafts
```

### Check Shortcode Rendering
Visit http://localhost:1313/podcast/

Verify:
- Three audio players visible
- Titles display correctly
- Download links present
- Play/pause controls work

### Verify Content-Type
```bash
curl -I https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3
```

Expected response headers:
```
HTTP/2 200
Content-Type: audio/mpeg
Cache-Control: public, max-age=31536000, immutable
```

## Error Messages

### Missing src parameter
```
Error: audio shortcode requires 'src' parameter
```
Solution: Add `src="..."` to shortcode

### File not found on R2 (404)
Audio player renders with controls, but clicking play shows browser error
Solution: Verify file is uploaded to R2 with correct path

### wrangler not found
```
[ERROR] wrangler CLI not found
```
Solution: `npm install -g wrangler` and authenticate

## Architecture

### Single Configuration Point
```
config.toml
  └─ mediaBaseUrl
      ├─ /podcast page uses audio shortcode
      ├─ audio shortcode prepends to relative paths
      └─ All URLs resolve to R2
```

### Caching Strategy
```
Browser Cache (1 year, immutable)
       ↓
Cloudflare Edge Cache (1 year)
       ↓
R2 Storage (source)
```

### URL Flow
```
Markdown: {{< audio src="podcasts/.../file.mp3" >}}
    ↓
Shortcode: prepend mediaBaseUrl
    ↓
HTML: <audio><source src="https://media.this-is-us.org/podcasts/.../file.mp3">
    ↓
Browser: Request from edge cache, fallback to R2
```

## Deployment

1. Hugo builds with shortcode + config change
2. Run upload script to populate R2
3. Set DNS CNAME for media.this-is-us.org to R2 domain
4. Deploy Hugo site
5. Podcast page now serves audio from R2

## Maintenance

### Change media domain
Edit one line in `config.toml`:
```toml
mediaBaseUrl = "https://new-domain.example.com"
```

### Add new podcast episode
1. Prepare MP3 files: `JR_RIGGINS_-04.mp3`, etc.
2. Update `content/podcast.md` with new audio shortcode
3. Run upload script (or upload manually to R2)

### Bulk upload old episodes
Update `scripts/media/r2_upload_podcasts.sh` to handle multiple dates/guests, or create variants:
```bash
BUCKET=podcasts DATE=2025-01-15 DIR=./january_files ./scripts/media/r2_upload_podcasts.sh
```

## See Also

- `PODCAST_IMPLEMENTATION.md` - Full documentation
- `PODCAST_TEST_CHECKLIST.md` - Complete test procedures
- `content/podcast.md` - Live example usage
- `layouts/shortcodes/audio.html` - Shortcode source code

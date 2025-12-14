# PODCAST MP3 PLAYBACK - TEST CHECKLIST

## Overview
This checklist validates the Cloudflare R2 podcast playback implementation for Hugo, including the audio shortcode, configuration, and R2 upload script.

## Pre-Test Setup

- [ ] Hugo site is running locally: `hugo server --buildDrafts`
- [ ] Media files are ready in `/home/anchor/projects/Media_Conversion/sound_files/`: `JR_RIGGINS_-01.mp3`, `JR_RIGGINS_-02.mp3`, `JR_RIGGINS_-03.mp3`
- [ ] Cloudflare R2 bucket is configured and wrangler CLI is authenticated
- [ ] config.toml has `mediaBaseUrl = "https://media.this-is-us.org"`

## Test 1: Hugo Site Configuration

- [ ] `hugo server` runs without errors
- [ ] No template errors in console output
- [ ] Site builds successfully: `hugo` command completes
- [ ] config.toml contains: `mediaBaseUrl = "https://media.this-is-us.org"` in [params]

## Test 2: Audio Shortcode Rendering

- [ ] Navigate to http://localhost:1313/podcast/
- [ ] Three audio player sections are visible (Part 1, Part 2, Part 3)
- [ ] Each section displays the correct title
- [ ] Each audio player shows the HTML5 `<audio controls>` element
- [ ] Play, pause, and volume controls are functional
- [ ] "Download this episode" links appear below each player

## Test 3: Audio Playback

- [ ] Click play on any audio element (will fail if files don't exist on R2, but controls should be responsive)
- [ ] Seeking works (slider moves when clicked or dragged)
- [ ] Volume control works (slider changes volume)
- [ ] Duration displays correctly if audio loads
- [ ] Time progress updates as playback occurs

## Test 4: URL Construction

In browser DevTools, inspect the `<audio>` tags:

- [ ] src attribute contains: `https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3`
- [ ] src attribute contains: `https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3`
- [ ] src attribute contains: `https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-03.mp3`
- [ ] Download links point to the same URLs

## Test 5: R2 Upload Script

### Dry Run (no files)
```bash
cd /home/anchor/projects/this-is-us
DIR=./nonexistent ./scripts/media/r2_upload_podcasts.sh
```
- [ ] Script exits with error about missing directory (expected)
- [ ] Error message is clear and helpful

### With Valid Files
```bash
mkdir -p ./test_sound_files
touch ./test_sound_files/JR_RIGGINS_-{01,02,03}.mp3
DIR=./test_sound_files BUCKET=test-podcasts ./scripts/media/r2_upload_podcasts.sh
```
- [ ] Script validates tools (wrangler, jq)
- [ ] Script validates input directory
- [ ] Script attempts to upload three files
- [ ] Script prints success messages for each upload
- [ ] Script displays final public URLs in summary
- [ ] URLs follow pattern: `https://media.this-is-us.org/test-podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-0X.mp3`

## Test 6: Content-Type Verification

Once files are uploaded to R2, verify headers:

```bash
curl -I https://media.this-is-us.org/podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3
```

- [ ] HTTP response includes: `Content-Type: audio/mpeg`
- [ ] HTTP response includes: `Cache-Control: public, max-age=31536000, immutable`
- [ ] HTTP status is 200 OK

## Test 7: Responsive Design

- [ ] Audio player displays correctly on desktop (full width or 500px max)
- [ ] Audio player is responsive on mobile
- [ ] Download links are readable on all screen sizes
- [ ] Player does not overflow on narrow screens

## Test 8: Error Handling

### Missing Shortcode Parameters
In content/test.md:
```markdown
{{< audio >}}
```

- [ ] Shortcode renders error message (not blank or broken)
- [ ] Error message states: "audio shortcode requires 'src' parameter"
- [ ] Site continues to build without crashing

### Unreachable Media URL
Modify shortcode src to: `podcasts/nonexistent/file.mp3`

- [ ] Audio player renders with controls
- [ ] Attempting to play shows browser error (404)
- [ ] Page does not crash

## Files Created/Modified

### Created
- [ ] `layouts/shortcodes/audio.html` - Audio shortcode template
- [ ] `scripts/media/r2_upload_podcasts.sh` - R2 upload script

### Modified
- [ ] `config.toml` - Added mediaBaseUrl parameter
- [ ] `content/podcast.md` - Added JR Riggins section with three audio players

## Summary

- [ ] All tests passed
- [ ] Audio shortcode works with environment-agnostic URLs
- [ ] R2 upload script is functional and user-friendly
- [ ] Hugo site builds and serves podcast content correctly
- [ ] Content-type and cache headers are properly set on R2

## Notes

- Audio files must be present on R2 (or accessible via mediaBaseUrl) for playback to work
- The shortcode automatically prepends mediaBaseUrl to relative paths like "podcasts/..."
- Absolute paths (starting with "/") use the Hugo site's baseURL instead
- Cache headers are set to max-age=31536000 (1 year) and immutable for optimal performance

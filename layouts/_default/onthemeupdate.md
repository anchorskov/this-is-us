# onthemeupdate.md

## Project: This Is US (Hugo + PaperMod)

---

## Theme Strategy

- Rely **directly** on PaperMod theme structure.
- **Do NOT override** `baseof.html`, `head.html`, or other core theme files unless absolutely necessary.
- **Extend functionality** safely via custom partials:
  - `layouts/partials/extend_head.html`
  - `layouts/partials/extend_footer.html`
  - `layouts/partials/floating-auth.html`
  - `layouts/partials/site-scripts.html`

## Current Overrides

| File | Purpose | Notes |
|:----|:--------|:-----|
| `layouts/partials/extend_head.html` | Add custom `<link>`, `<meta>`, custom styles | Loaded automatically by PaperMod's head partial |
| `layouts/partials/extend_footer.html` | Add extra `<script>` for scroll behavior, floating auth, analytics | Loaded automatically at end of page |
| `layouts/index.html` | Custom homepage layout | Lightweight, minimal deviation from theme |

## Customization Guidelines

- **CSS/JS** customizations go inside `/assets/` or `/static/`.
- **New components** must be injected only through `extend_*` partials.
- **New layouts** (e.g., `/login/single.html`) must independently work without altering base theme.

## Update Instructions

When updating PaperMod:

1. Backup current `/themes/PaperMod/`.
2. Update theme normally (e.g., `git pull`, or replacing folder).
3. Recheck:
   - `/layouts/partials/extend_head.html`
   - `/layouts/partials/extend_footer.html`
   - `/layouts/index.html`
4. Ensure custom behavior still works.
5. If theme changes layout flow (rare), adapt extensions, **not** base files.

## Known PaperMod Dependencies

- `head.html` expects `author.html` partial inside the theme.
- `footer.html` manages its own copyright.
- Scroll-to-top and theme toggle JS inserted automatically.

---

✅ Minimal footprint on theme = Easy upgrades.

# Always prefer **EXTEND** over **OVERRIDE**.

---

_"If you touch the theme, you marry the maintenance. If you extend it, you stay free."_

# End of File


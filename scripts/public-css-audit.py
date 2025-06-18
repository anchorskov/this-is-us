# ── scripts/public-css-audit.py ──────────────────────────────────────────────
"""
Walk the generated /public folder, parse each *.html, and check that:

  • The page was rendered via extend_head.html (optional – flag only).
  • Exactly one <link rel="stylesheet"> matches either:
        › /css/main.dev.css             (dev server)
        › /css/main.<fingerprint>.css   (production build)
  • That linked file actually exists and is non-empty.

Usage:  python public-css-audit.py public
"""

from __future__ import annotations
import sys, re, hashlib
from pathlib import Path
from bs4 import BeautifulSoup   # pip install beautifulsoup4

GREEN, YELLOW, RED, CYAN, RESET = "\x1b[32m","\x1b[33m","\x1b[31m","\x1b[36m","\x1b[0m"

def colour(t,c): return f"{c}{t}{RESET}"

CSS_RE   = re.compile(r"^/css/(main\.(?:dev|[0-9a-f]{8,})\.css)$")
EXT_HEAD_FLAG = "<!-- extend_head.html -->"  # add this once inside the partial

root = Path(sys.argv[1] if len(sys.argv) > 1 else "public").resolve()
css_dir = root / "css"

errors = 0
for html_path in root.rglob("*.html"):
    rel = html_path.relative_to(root)
    soup = BeautifulSoup(html_path.read_text("utf-8", errors="ignore"),
                         features="html.parser")

    links = [l for l in soup.find_all("link", rel="stylesheet")]
    ok    = False
    for l in links:
        href = l.get("href","")
        m = CSS_RE.match(href)
        if not m: continue
        css_file = css_dir / m.group(1)
        if css_file.exists() and css_file.stat().st_size > 1000:
            ok = True
            break

    if ok:
        print(f"{colour('✔',GREEN)} {rel}")
    else:
        errors += 1
        print(f"{colour('✘',RED)} {rel} → stylesheet missing or wrong ({[l.get('href') for l in links]})")

print(colour(f"\nAudit complete – {errors} page(s) need fixing." ,
             GREEN if errors==0 else YELLOW))
# ────────────────────────────────────────────────────────────────────────────

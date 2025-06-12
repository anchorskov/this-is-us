# summarize-logic.py – v3.4 (Town Hall Debug Edition)
"""
CLI tool to generate a logic map of the This‑Is‑Us repo **and** surface
common Town Hall wiring mistakes.

Improvements in v3.4
--------------------
* **Argparse CLI** – `--townhall-only`, `--skip-index`, `--output` flags
* **Script/Template presence check** – lists missing JS & layout files
* **Thread sanity audit** – validates `slug`, `lat`, `lon` front‑matter keys
* **Colorised warnings** (using ANSI) for at‑a‑glance triage
* **Smarter ignore rules** – collapses large folders faster

Usage examples
--------------
```bash
# Full project sweep, write logic-index-v3.md (default)
python summarize-logic.py

# Focus on Town Hall only, print to stdout
python summarize-logic.py --townhall-only --output -
```
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import List, Set

try:
    import frontmatter  # type: ignore
except ImportError:
    print("⚠️  pip install python-frontmatter for full feature support", file=sys.stderr)
    frontmatter = None  # fallback safe‑guard

BASE_DIR = Path('.')
TARGET_EXTENSIONS = {'.js', '.html', '.mjs', '.py', '.md', '.toml', '.sql'}
IGNORED_DIRS = {
    'node_modules', '__pycache__', '.git', 'venv', 'static/admin', 'themes', 'public',
    'dist', 'build', '.wrangler', '.parcel-cache', '.idea', '.vscode', '.pytest_cache',
}
IGNORED_EXTENSIONS = {'.bak', '.tmp', '.log'}

TOWNHALL_EXPECTED_LAYOUTS = [
    'layouts/townhall/list.html',
    'layouts/townhall/thread.html',
    'layouts/townhall/create.html',
    'layouts/section/townhall.html',
]
TOWNHALL_EXPECTED_JS = [
    'static/js/townhall/home.js',
    'static/js/townhall/threads.js',
    'static/js/townhall/thread-view.js',
]
RE_FRONTMATTER_COORDS = re.compile(r"(lat|latitude|lon|lng|longitude)")

# ANSI helpers
RED = '\u001b[31m'; YELLOW = '\u001b[33m'; GREEN = '\u001b[32m'; RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    return f"{col}{text}{RESET}"


def extract_summary(path: Path) -> str:
    try:
        lines = path.read_text(encoding='utf-8', errors='ignore').splitlines()
        comments = [ln.strip() for ln in lines if ln.strip().startswith(('//', '#', '--', '/*'))]
        return ' '.join(comments[:3]) if comments else '(no summary)'
    except Exception:
        return '(unreadable)'


def extract_defs(path: Path) -> List[str]:
    try:
        code = path.read_text(encoding='utf-8', errors='ignore')
        defs: Set[str] = set()
        defs.update(re.findall(r'^\s*def\s+(\w+)', code, re.MULTILINE))
        defs.update(re.findall(r'^\s*class\s+(\w+)', code, re.MULTILINE))
        defs.update(re.findall(r'function\s+(\w+)', code))
        defs.update(re.findall(r'export function\s+(\w+)', code))
        return sorted(defs) or ['(no defs)']
    except Exception:
        return ['(unreadable)']


def should_skip(path: Path) -> bool:
    if any(part in IGNORED_DIRS for part in path.parts):
        return True
    if path.suffix.lower() in IGNORED_EXTENSIONS:
        return True
    return False


def walk_directory(base: Path, capture: List[str]):
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for fname in files:
            fpath = Path(root) / fname
            if should_skip(fpath):
                continue
            if fpath.suffix.lower() in TARGET_EXTENSIONS:
                rel = fpath.relative_to(base)
                capture.append(f"\n### `{rel}`\n\n**Summary**: {extract_summary(fpath)}\n\n**Definitions**:\n" + '\n'.join(f"- `{d}`" for d in extract_defs(fpath)))


def audit_townhall(capture: List[str]):
    capture.append("\n## 🔍 Town Hall Debug Audit\n")
    # Layout presence
    capture.append("### Layout templates\n")
    for rel in TOWNHALL_EXPECTED_LAYOUTS:
        status = colour('✅ found', GREEN) if Path(rel).exists() else colour('❌ missing', RED)
        capture.append(f"- `{rel}` – {status}")
    # JS presence
    capture.append("\n### Critical JS files\n")
    for rel in TOWNHALL_EXPECTED_JS:
        status = colour('✅ found', GREEN) if Path(rel).exists() else colour('❌ missing', RED)
        capture.append(f"- `{rel}` – {status}")
    # Thread sanity check
    threads_dir = Path('content/townhall/thread')
    if not threads_dir.exists():
        capture.append(colour("⚠️  No markdown threads found under content/townhall/thread", YELLOW))
        return
    capture.append("\n### Thread front‑matter sanity\n")
    for md in threads_dir.glob('*.md'):
        try:
            if frontmatter:
                post = frontmatter.load(md)
                errs = []
                for key in ('slug', 'lat', 'lon'):
                    if key not in post:
                        errs.append(key)
                for coord in ('lat', 'lon'):
                    if coord in post and not isinstance(post[coord], (int, float)):
                        errs.append(f"{coord}‑format")
                if errs:
                    capture.append(f"- `{md}` → " + colour('issues: ' + ', '.join(errs), YELLOW))
        except Exception as e:
            capture.append(f"- `{md}` → " + colour(f'error: {e}', RED))


def main():
    parser = argparse.ArgumentParser(description="Generate logic index & Town Hall audit.")
    parser.add_argument('--townhall-only', action='store_true', help='Only run Town Hall audit.')
    parser.add_argument('--skip-index', action='store_true', help='Skip file index generation.')
    parser.add_argument('--output', default='logic-index-v3.md', help='Path or - for stdout')
    args = parser.parse_args()

    capture: List[str] = ["# Logic Index – This Is Us Project (v3.4)\n"]

    if not args.townhall_only and not args.skip_index:
        walk_directory(BASE_DIR, capture)

    audit_townhall(capture)

    output_text = '\n'.join(capture)

    if args.output == '-':
        print(output_text)
    else:
        Path(args.output).write_text(output_text, encoding='utf-8')
        print(colour(f"✅ {args.output} generated", GREEN))


if __name__ == '__main__':
    main()

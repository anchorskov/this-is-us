# summarize-logic.py – v3.6 (HTML Script Analysis)
"""
CLI tool to generate a logic map of the This‑Is‑Us repo and surface
common Town Hall wiring mistakes, with enhanced code analysis.

Improvements in v3.6
--------------------
* **Improved `analyze_file_code`**: Now `analyze_file_code` which identifies functions, classes,
  and also common import/export patterns for better dependency mapping.
* **API Endpoint Detection**: Scans for common API route definitions (e.g., `router.get`, `export default { fetch }`).
* **Hugo Partial/Template Usage**: Identifies `{{ partial }}` and `{{ template }}` calls within Hugo layouts.
* **New HTML Script Source Detection**: Extracts `script src="..."` from HTML files to list external JavaScript dependencies.
* **New Audit Sections**:
    * "API Endpoints Found" for Cloudflare Workers.
    * "Hugo Template Usage" for better understanding layout composition.
    * "External JavaScript Includes" for a consolidated view of scripts loaded by HTML.

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
from collections import defaultdict
from pathlib import Path
from typing import List, Set, Dict, Any

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

# Regex patterns for various code elements
RE_DEFINITIONS = re.compile(
    r'^\s*(def|class|function|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\s*(\w+)',
    re.MULTILINE
)
RE_JS_IMPORTS_EXPORTS = re.compile(
    r'(?:import(?:["\'\s]*(?:[\w*{}\n\r\t, ]+)\s*from\s*)?["\'`](.*?)["\'`])|'
    r'(?:require\s*\(\s*["\'`](.*?)["\'`]\s*\))|'
    r'(?:export(?:\s+default)?(?:\s+(?:function|class|const|let|var))?\s*(\w+))',
    re.MULTILINE
)
RE_PY_IMPORTS = re.compile(r'^\s*(?:from\s+([\w.]+)\s+)?import\s+([\w.,\s]+)', re.MULTILINE)
RE_API_ENDPOINTS = re.compile(
    r'(?:router|app|proxy)\.(get|post|put|delete|patch|options)\s*\(\s*["\'`](.*?)["\'`]',
    re.MULTILINE | re.IGNORECASE
)
RE_HUGO_PARTIALS = re.compile(r'\{\{\s*(?:partial|template)\s+["\'"](.+?)["\'"]', re.MULTILINE)
RE_HTML_SCRIPT_SRC = re.compile(r'<script\s+[^>]*?src=["\'](.+?)["\']', re.MULTILINE)


# ANSI helpers
RED = '\u001b[31m'; YELLOW = '\u001b[33m'; GREEN = '\u001b[32m'; RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    return f"{col}{text}{RESET}"

def extract_summary(path: Path) -> str:
    """Extracts a brief summary from the beginning of the file."""
    try:
        lines = path.read_text(encoding='utf-8', errors='ignore').splitlines()
        comments = [ln.strip() for ln in lines if ln.strip().startswith(('//', '#', '--', '/*', '---'))]
        if not comments and path.suffix == '.md' and frontmatter:
            try:
                post = frontmatter.load(path)
                if 'title' in post.metadata:
                    return f"Title: {post.metadata['title']}"
                if 'description' in post.metadata:
                    return f"Description: {post.metadata['description']}"
            except Exception:
                pass # Fallback to no summary if frontmatter fails
        return ' '.join(comments[:5]) if comments else '(no summary)' # Increased lines for more context
    except Exception:
        return '(unreadable)'

def analyze_file_code(path: Path) -> Dict[str, Any]:
    """Analyzes file content for definitions, imports/exports, and API endpoints."""
    results: Dict[str, Any] = defaultdict(list)
    try:
        code = path.read_text(encoding='utf-8', errors='ignore')

        # Definitions (functions, classes, const/let/var assignments for JS)
        for match in RE_DEFINITIONS.finditer(code):
            # Group 2 is the actual name
            name = match.group(2)
            if name and name not in results['definitions']:
                results['definitions'].append(name)
        
        # Imports/Exports
        if path.suffix in {'.js', '.mjs'}:
            for match in RE_JS_IMPORTS_EXPORTS.finditer(code):
                # Group 1: import source, Group 2: require source, Group 3: export name
                if match.group(1): # import
                    results['imports_exports'].append(f"import '{match.group(1)}'")
                elif match.group(2): # require
                    results['imports_exports'].append(f"require('{match.group(2)}')")
                elif match.group(3): # export
                    results['imports_exports'].append(f"export {match.group(3)}")
        elif path.suffix == '.py':
            for match in RE_PY_IMPORTS.finditer(code):
                from_path = match.group(1)
                imports = match.group(2).split(',')
                for imp in imports:
                    if from_path:
                        results['imports_exports'].append(f"from {from_path} import {imp.strip()}")
                    else:
                        results['imports_exports'].append(f"import {imp.strip()}")

        # API Endpoints
        if path.suffix in {'.js', '.mjs'} and (
            'worker/src/routes' in path.parts or
            'mcp/src/routes' in path.parts or
            'ballots/src' in path.parts # Check all workers
        ):
            for match in RE_API_ENDPOINTS.finditer(code):
                method = match.group(1).upper()
                route = match.group(2)
                results['api_endpoints'].append(f"{method} {route}")
        
        # Hugo Partials/Templates
        if path.suffix == '.html' and 'layouts' in path.parts:
            for match in RE_HUGO_PARTIALS.finditer(code):
                results['hugo_partials'].append(match.group(1))
            
            # HTML Script Sources
            for match in RE_HTML_SCRIPT_SRC.finditer(code):
                results['html_script_src'].append(match.group(1))


    except Exception:
        results['definitions'] = ['(unreadable)']
        results['imports_exports'] = ['(unreadable)']
        results['api_endpoints'] = ['(unreadable)']
        results['hugo_partials'] = ['(unreadable)']
        results['html_script_src'] = ['(unreadable)']

    # Ensure sorted unique lists
    results['definitions'] = sorted(list(set(results['definitions']))) or ['(no defs)']
    results['imports_exports'] = sorted(list(set(results['imports_exports']))) or ['(no imports/exports)']
    results['api_endpoints'] = sorted(list(set(results['api_endpoints'])))
    results['hugo_partials'] = sorted(list(set(results['hugo_partials'])))
    results['html_script_src'] = sorted(list(set(results['html_script_src'])))
    
    return results

def should_skip(path: Path) -> bool:
    """Determines if a path should be skipped based on ignored directories and extensions."""
    if any(part in IGNORED_DIRS for part in path.parts):
        return True
    if path.suffix.lower() in IGNORED_EXTENSIONS:
        return True
    return False

def walk_directory(base: Path, capture: List[str]):
    """Recursively walks the directory, analyzes files, and captures summary."""
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS] # In-place modification to prevent walking ignored dirs
        for fname in files:
            fpath = Path(root) / fname
            if should_skip(fpath):
                continue
            if fpath.suffix.lower() in TARGET_EXTENSIONS:
                rel = fpath.relative_to(base)
                analysis = analyze_file_code(fpath)
                
                capture.append(f"\n### `{rel}`\n")
                capture.append(f"**Summary**: {extract_summary(fpath)}\n")
                
                capture.append("**Definitions**:\n" + '\n'.join(f"- `{d}`" for d in analysis['definitions']))
                
                if analysis['imports_exports'] and analysis['imports_exports'] != ['(no imports/exports)']:
                    capture.append("\n**Imports/Exports**:\n" + '\n'.join(f"- `{ie}`" for ie in analysis['imports_exports']))
                
                if analysis['api_endpoints']:
                    capture.append("\n**API Endpoints**:\n" + '\n'.join(f"- `{ep}`" for ep in analysis['api_endpoints']))
                
                if analysis['hugo_partials']:
                    capture.append("\n**Hugo Partials/Templates Used**:\n" + '\n'.join(f"- `{hp}`" for hp in analysis['hugo_partials']))
                
                if analysis['html_script_src']:
                    capture.append("\n**HTML Script Sources**:\n" + '\n'.join(f"- `{src}`" for src in analysis['html_script_src']))


def audit_townhall(capture: List[str]):
    """Performs specific audits for Town Hall features."""
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
    capture.append("\n### Thread front‑matter sanity\n")
    if not threads_dir.exists():
        capture.append(colour("⚠️  No markdown threads found under content/townhall/thread", YELLOW))
    else:
        found_threads = False
        for md in threads_dir.glob('*.md'):
            found_threads = True
            try:
                if frontmatter:
                    post = frontmatter.load(md)
                    errs = []
                    # Check for slug and lat/lon keys
                    for key in ('slug', 'lat', 'lon'):
                        if key not in post.metadata:
                            errs.append(key)
                    # Check for lat/lon format
                    for coord in ('lat', 'lon'):
                        if coord in post.metadata and not isinstance(post.metadata[coord], (int, float)):
                            errs.append(f"{coord}‑format")
                    if errs:
                        capture.append(f"- `{md.relative_to(BASE_DIR)}` → " + colour('issues: ' + ', '.join(errs), YELLOW))
                else:
                    capture.append(f"- `{md.relative_to(BASE_DIR)}` → " + colour('skipped (python-frontmatter not installed)', YELLOW))
            except Exception as e:
                capture.append(f"- `{md.relative_to(BASE_DIR)}` → " + colour(f'error parsing: {e}', RED))
        if not found_threads:
            capture.append(colour("⚠️  No markdown thread files found in content/townhall/thread", YELLOW))


def audit_api_endpoints(capture: List[str]):
    """Audits and lists detected API endpoints from workers."""
    capture.append("\n## 🌐 API Endpoints Found\n")
    all_endpoints: List[str] = []
    worker_dirs = [Path('ballots/src'), Path('worker/src'), Path('mcp/src')]
    for worker_dir in worker_dirs:
        if not worker_dir.exists():
            continue
        for root, _, files in os.walk(worker_dir):
            for fname in files:
                fpath = Path(root) / fname
                if fpath.suffix in {'.js', '.mjs'}:
                    analysis = analyze_file_code(fpath)
                    if analysis['api_endpoints']:
                        all_endpoints.extend([f"{ep} ({fpath.relative_to(BASE_DIR)})" for ep in analysis['api_endpoints']])
    
    if all_endpoints:
        for ep in sorted(list(set(all_endpoints))):
            capture.append(f"- `{ep}`")
    else:
        capture.append(colour("No API endpoints detected in worker directories.", YELLOW))

def audit_hugo_partials(capture: List[str]):
    """Audits and lists detected Hugo partial/template usages."""
    capture.append("\n## 📄 Hugo Template Usage\n")
    all_hugo_partials: List[str] = []
    layouts_dir = Path('layouts')
    if not layouts_dir.exists():
        capture.append(colour("⚠️  'layouts' directory not found.", YELLOW))
        return

    for root, _, files in os.walk(layouts_dir):
        for fname in files:
            fpath = Path(root) / fname
            if fpath.suffix == '.html':
                analysis = analyze_file_code(fpath)
                if analysis['hugo_partials']:
                    all_hugo_partials.extend([
                        f"`{hp}` called in `{fpath.relative_to(BASE_DIR)}`"
                        for hp in analysis['hugo_partials']
                    ])
    
    if all_hugo_partials:
        for hp_call in sorted(list(set(all_hugo_partials))):
            capture.append(f"- {hp_call}")
    else:
        capture.append(colour("No Hugo partials or templates detected.", YELLOW))

def audit_html_script_sources(capture: List[str]):
    """Audits and lists detected external script sources in HTML files."""
    capture.append("\n## 🔗 External JavaScript Includes\n")
    all_script_srcs: List[str] = []
    
    # Check all HTML files in layouts and content (as they might contain direct script tags)
    dirs_to_check = [Path('layouts'), Path('content')]
    for check_dir in dirs_to_check:
        if not check_dir.exists():
            continue
        for root, _, files in os.walk(check_dir):
            for fname in files:
                fpath = Path(root) / fname
                if fpath.suffix == '.html':
                    analysis = analyze_file_code(fpath)
                    if analysis['html_script_src']:
                        all_script_srcs.extend([
                            f"`{src}` in `{fpath.relative_to(BASE_DIR)}`"
                            for src in analysis['html_script_src']
                        ])
    
    if all_script_srcs:
        for src_path in sorted(list(set(all_script_srcs))):
            capture.append(f"- {src_path}")
    else:
        capture.append(colour("No external JavaScript `src` attributes detected in HTML files.", YELLOW))


def main():
    parser = argparse.ArgumentParser(description="Generate logic index & Town Hall audit.")
    parser.add_argument('--townhall-only', action='store_true', help='Only run Town Hall audit.')
    parser.add_argument('--skip-index', action='store_true', help='Skip file index generation.')
    parser.add_argument('--output', default='logic-index-v3.md', help='Path or - for stdout')
    args = parser.parse_args()

    capture: List[str] = ["# Logic Index – This Is Us Project (v3.6)\n"]

    if not args.townhall_only and not args.skip_index:
        walk_directory(BASE_DIR, capture)

    audit_townhall(capture)
    audit_api_endpoints(capture) # New audit section
    audit_hugo_partials(capture) # New audit section
    audit_html_script_sources(capture) # New audit section for HTML script sources

    output_text = '\n'.join(capture)

    if args.output == '-':
        print(output_text)
    else:
        Path(args.output).write_text(output_text, encoding='utf-8')
        print(colour(f"✅ {args.output} generated", GREEN))


if __name__ == '__main__':
    main()

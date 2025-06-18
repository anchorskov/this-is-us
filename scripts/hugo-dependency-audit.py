# scripts/hugo-dependency-audit.py
"""
A comprehensive audit tool to analyze the Hugo project structure.
It traces the relationship between content files, layouts, and partials
to diagnose inconsistencies in styling and script loading.
"""
from __future__ import annotations
import os
import re
from pathlib import Path

# --- Configuration ---
BASE_DIR = Path('.')
IGNORED_DIRS = {".git", "node_modules", ".venv", "public", "resources"}
RE_FRONTMATTER_KEY = re.compile(r'^\s*(\w+)\s*[:=]\s*["\']?(.*?)["\']?\s*$')
RE_PARTIAL_CALL = re.compile(r'{{\-?\s*(?:partial|template)\s*["\'](.*?)["\']')

# --- ANSI Colors ---
GREEN = '\u001b[32m'
RED = '\u001b[31m'
YELLOW = '\u001b[33m'
CYAN = '\u001b[36m'
RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    """Applies ANSI color codes to text."""
    return f"{col}{text}{RESET}"

def get_front_matter(content: str) -> dict[str, str]:
    """Parses front matter from a content file."""
    fm = {}
    in_front_matter = False
    for line in content.splitlines():
        if line.strip() == '---':
            if not fm and in_front_matter: # End of front matter
                break
            in_front_matter = True
            continue
        if in_front_matter:
            match = RE_FRONTMATTER_KEY.match(line)
            if match:
                fm[match.group(1).strip()] = match.group(2).strip()
    return fm

def find_layout_file(fm: dict, section: str, kind: str) -> Path | None:
    """Finds the layout file for a content page based on Hugo's lookup order."""
    lookup_paths = []
    # Rule 1: `layout` key
    if 'layout' in fm:
        lookup_paths.append(Path(f"layouts/{fm['layout']}.html"))
    
    # Rule 2: `type` key
    if 'type' in fm:
        lookup_paths.append(Path(f"layouts/{fm['type']}/{kind}.html"))

    # Rule 3: Section layout
    if section:
        lookup_paths.append(Path(f"layouts/{section}/{kind}.html"))

    # Rule 4: Default layout
    lookup_paths.append(Path(f"layouts/_default/{kind}.html"))
    
    for path in lookup_paths:
        if path.exists():
            return path
    
    return None

def trace_partials(layout_path: Path, partials_found: set, checked_paths: set):
    """Recursively finds all partials included by a layout file, now aware of baseof.html."""
    if layout_path in checked_paths or not layout_path.exists():
        return
    
    checked_paths.add(layout_path)
    partials_found.add(layout_path)
    
    try:
        content = layout_path.read_text(encoding='utf-8', errors='ignore')
        
        # If it's a template that defines a block, it likely uses baseof.html
        if '{{ define' in content and '<html>' not in content:
            baseof_path = Path('layouts/_default/baseof.html')
            if baseof_path.exists():
                trace_partials(baseof_path, partials_found, checked_paths)

        # Find all partial calls in the current file
        for partial_match in RE_PARTIAL_CALL.finditer(content):
            partial_name = partial_match.group(1).split(' ')[0] # Get name before context `.`
            next_layout_path = Path(f"layouts/partials/{partial_name}")
            trace_partials(next_layout_path, partials_found, checked_paths)
            
    except Exception:
        pass


def main():
    """Main function to run the analysis and print the report."""
    print(colour("🚀 Running Hugo Dependency Audit (v2)...", GREEN))
    print("-" * 50)

    content_dir = Path('./content')
    
    for root, _, files in os.walk(content_dir):
        # Skip ignored directories
        if any(ignored in Path(root).parts for ignored in IGNORED_DIRS):
            continue

        for filename in files:
            if not filename.endswith('.md'):
                continue
            
            fpath = Path(root) / filename
            rel_path = fpath.relative_to(BASE_DIR)
            print(f"📄 {colour(str(rel_path), CYAN)}")

            try:
                content = fpath.read_text(encoding='utf-8', errors='ignore')
                fm = get_front_matter(content)
                
                # Determine section and kind for layout lookup
                try:
                    section = fpath.relative_to(content_dir).parts[0]
                except IndexError:
                    section = ""
                kind = "single" if filename != '_index.md' else "list"

                layout_file = find_layout_file(fm, section, kind)

                if not layout_file:
                    print(f"   {colour('❌ ERROR:', RED)} Could not find a matching layout file.")
                    continue
                
                print(f"   {colour('→', YELLOW)} Uses Layout: `{layout_file}`")

                # Trace partials to see if extend_head.html is loaded
                included_partials = set()
                trace_partials(layout_file, included_partials, set())
                
                is_standalone = '<html>' in layout_file.read_text(encoding='utf-8', errors='ignore')
                if is_standalone:
                     print(f"   {colour('→', YELLOW)} Analysis: This is a standalone layout.")

                extend_head_path = Path('layouts/partials/extend_head.html')
                if extend_head_path in included_partials:
                    print(f"   {colour('✅ SUCCESS:', GREEN)} Loads global styles from `extend_head.html`.")
                else:
                    print(f"   {colour('❌ NOTE:', RED)} Does NOT load global styles from `extend_head.html`.")

            except Exception as e:
                print(f"   {colour('❌ ERROR:', RED)} Could not process file: {e}")
            
            print() # Newline for readability

    print(colour("✅ Audit Complete.", GREEN))

if __name__ == "__main__":
    main()

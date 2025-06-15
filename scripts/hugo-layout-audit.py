# scripts/hugo-layout-audit.py
"""
A focused analysis tool to verify that Hugo content files have
corresponding layout files according to Hugo's lookup order.
This helps diagnose and fix 404 and incorrect template errors.
"""
from __future__ import annotations

import os
from pathlib import Path
import re

# --- ANSI Colors for Readability ---
GREEN = '\u001b[32m'
RED = '\u001b[31m'
YELLOW = '\u001b[33m'
RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    """Applies ANSI color codes to text."""
    return f"{col}{text}{RESET}"

def get_front_matter_value(content: str, key: str) -> str | None:
    """Extracts a value from TOML-like front matter."""
    match = re.search(fr'^\s*{key}\s*=\s*["\'](.*?)["\']', content, re.MULTILINE)
    if match:
        return match.group(1)
    # Also check YAML format
    match = re.search(fr'^\s*{key}\s*:\s*(.*)', content, re.MULTILINE)
    if match:
        return match.group(1).strip().strip("'\"")
    return None

def find_layout(content_file: Path) -> str:
    """
    Checks for a corresponding layout file based on Hugo's lookup order.
    Returns the status as a formatted string.
    """
    try:
        content = content_file.read_text(encoding='utf-8')
        if not content.strip().startswith('---'):
            return colour("⚠️ No Front Matter", YELLOW)

        layout_type = get_front_matter_value(content, 'type')
        layout_specific = get_front_matter_value(content, 'layout')
        section = content_file.parent.name if content_file.parent.name != 'content' else ''

        # --- Hugo's Layout Lookup Order ---
        # 1. Specific `layout` in front matter
        if layout_specific:
            # layouts/section/layout.html or layouts/layout.html
            potential_paths = [
                Path(f"layouts/{layout_specific}.html"),
            ]
            for p in potential_paths:
                if p.exists():
                    return f"{colour('✅ Found Layout:', GREEN)} `{p}` (from `layout` key)"
            return f"{colour('❌ Not Found:', RED)} No layout found for `layout: \"{layout_specific}\"`"

        # 2. Specific `type` in front matter
        if layout_type:
            # layouts/TYPE/single.html
            p = Path(f"layouts/{layout_type}/single.html")
            if p.exists():
                return f"{colour('✅ Found Layout:', GREEN)} `{p}` (from `type` key)"
            return f"{colour('❌ Not Found:', RED)} No layout at `layouts/{layout_type}/single.html`"

        # 3. Section-based layout
        if section:
            # layouts/section/single.html or layouts/section/list.html
            kind = "single" if content_file.name != '_index.md' else "list"
            p = Path(f"layouts/{section}/{kind}.html")
            if p.exists():
                return f"{colour('✅ Found Layout:', GREEN)} `{p}` (from section)"
            
        # 4. Default layout
        kind = "single" if content_file.name != '_index.md' else "list"
        p = Path(f"layouts/_default/{kind}.html")
        if p.exists():
            return f"{colour('✅ Found Layout:', GREEN)} `{p}` (default)"

        return colour("❌ No Matching Layout Found", RED)

    except Exception as e:
        return colour(f"Error analyzing file: {e}", RED)


def main():
    """Main function to run the analysis and print the report."""
    print(colour("🚀 Running Hugo Layout Alignment Audit...", GREEN))
    print("-" * 40)

    content_dir = Path('./content')
    if not content_dir.exists():
        print(f"Error: Directory not found at {content_dir}")
        return

    # Walk through the content directory
    for root, _, files in os.walk(content_dir):
        for filename in files:
            if filename.endswith('.md'):
                fpath = Path(root) / filename
                rel_path = fpath.relative_to(content_dir)
                status = find_layout(fpath)
                print(f"📄 File: `{rel_path}`\n   ↳ Status: {status}\n")

    print(colour("✅ Audit Complete.", GREEN))

if __name__ == '__main__':
    main()

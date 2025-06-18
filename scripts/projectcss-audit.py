#!/usr/bin/env python3
# ----------------------------------------------------------------
# File: /scripts/project-audit.py
# Description: Generates a Markdown "Logic Index" for the site,
#              with a special audit for the CSS build process.
# Dependencies: None
# ----------------------------------------------------------------
"""
CLI tool to generate a logic and asset map of the Hugo project,
with a dedicated audit for the unified CSS build pipeline.

Usage:
    python scripts/project-audit.py
"""

from __future__ import annotations

import argparse
import os
import re
from collections import defaultdict
from pathlib import Path

# --- Configuration ---
BASE_DIR = Path('.')
IGNORED_DIRS = {".git", ".hg", "node_modules", ".venv", "public", "resources"}
RE_IMPORT = re.compile(r'@import\s+["\'](.*?)["\'];')
RE_PKG_SCRIPT = re.compile(r'"(build:css|watch:css)"\s*:\s*"(.*?)"')

# --- ANSI Colors ---
GREEN = '\u001b[32m'
RED = '\u001b[31m'
YELLOW = '\u001b[33m'
RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    """Applies ANSI color codes to text."""
    return f"{col}{text}{RESET}"

def audit_css_build() -> list[str]:
    """Audits the unified CSS build setup."""
    report = [
        "\n## 🎨 Unified CSS Build Audit\n",
        "This section checks if the main CSS source file and its imports are set up correctly."
    ]
    has_errors = False

    # 1. Check for the main PostCSS input file
    main_pcss_path = Path('assets/css/main.pcss')
    if main_pcss_path.exists():
        report.append(f"- {colour('✅ Found:', GREEN)} Master input file at `{main_pcss_path}`.")
        
        # 2. Check the imports within main.pcss
        try:
            content = main_pcss_path.read_text()
            imports = RE_IMPORT.findall(content)
            if not imports:
                report.append(f"  - {colour('⚠️ Warning:', YELLOW)} No `@import` statements found in `{main_pcss_path}`.")
            else:
                report.append(f"  - Found {len(imports)} import statement(s):")
                for imp_path_str in imports:
                    imp_path = main_pcss_path.parent / Path(imp_path_str)
                    if imp_path.exists():
                        report.append(f"    - {colour('✅ OK:', GREEN)} Importing `{imp_path_str}`")
                    else:
                        report.append(f"    - {colour('❌ ERROR:', RED)} Tries to import non-existent file: `{imp_path_str}` (Expected at `{imp_path}`)")
                        has_errors = True
        except Exception as e:
            report.append(f"  - {colour('❌ ERROR:', RED)} Could not read or parse `{main_pcss_path}`: {e}")
            has_errors = True
            
    else:
        report.append(f"- {colour('❌ CRITICAL:', RED)} Master input file `assets/css/main.pcss` is missing.")
        has_errors = True

    # 3. Check the build scripts in package.json
    pkg_json_path = Path('package.json')
    if pkg_json_path.exists():
        try:
            content = pkg_json_path.read_text()
            scripts = dict(RE_PKG_SCRIPT.findall(content))
            for script_name, command in scripts.items():
                if str(main_pcss_path) in command:
                    report.append(f"- {colour('✅ Found:', GREEN)} `package.json` script `'{script_name}'` correctly points to `{main_pcss_path}`.")
                else:
                    report.append(f"- {colour('❌ ERROR:', RED)} `package.json` script `'{script_name}'` does not seem to use `{main_pcss_path}` as input.")
                    has_errors = True
        except Exception as e:
            report.append(f"- {colour('❌ ERROR:', RED)} Could not read or parse `package.json`: {e}")
            has_errors = True
    else:
        report.append(f"- {colour('⚠️ Warning:', YELLOW)} `package.json` not found. Could not verify build scripts.")

    if not has_errors:
        report.append(f"\n{colour('✅ CSS build pipeline appears to be configured correctly.', GREEN)}")

    return report


def main():
    """Main function to run the analysis and print the report."""
    parser = argparse.ArgumentParser(description="Generate a project audit report.")
    parser.add_argument("--output", default="project-audit.md", help="Path to write result.")
    args = parser.parse_args()

    # --- Run Audits ---
    css_audit_report = audit_css_build()
    
    # --- Generate Markdown ---
    output_lines = ["# Project Audit\n"]
    output_lines.extend(css_audit_report)
    
    # --- Write Output ---
    output_text = "\n".join(output_lines)
    Path(args.output).write_text(output_text, encoding="utf-8")
    print(f"\n✅  Audit complete. Report written to `{args.output}`.")


if __name__ == "__main__":
    main()

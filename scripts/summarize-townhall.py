# scripts/summarize-townhall.py
"""
A focused analysis tool to understand the functionality of the
JavaScript files in the 'static/js/townhall/' directory.
"""
from __future__ import annotations

import argparse
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import List, Dict, Any

# --- Configuration ---
TOWNHALL_JS_DIR = Path('./static/js/townhall/')

# Regex to find function declarations and important variable assignments
RE_DEFINITIONS = re.compile(
    r'^\s*(?:function\s+(\w+)|const\s+([\w\d_]+)\s*=\s*\(|async\s+function\s+(\w+))',
    re.MULTILINE
)

# Regex to find Firestore collection queries
RE_FIRESTORE_QUERIES = re.compile(
    r'\.collection\s*\(\s*["\']([\w\d_]+)["\']\s*\)',
    re.MULTILINE
)

# Regex to find element selections by ID
RE_GET_ELEMENT_BY_ID = re.compile(
    r'document\.getElementById\s*\(\s*["\']([\w\d_-]+)["\']\s*\)',
    re.MULTILINE
)

# --- ANSI Colors for Readability ---
GREEN = '\u001b[32m'
YELLOW = '\u001b[33m'
RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    """Applies ANSI color codes to text."""
    return f"{col}{text}{RESET}"

def analyze_js_file(path: Path) -> Dict[str, Any]:
    """Analyzes a single JavaScript file for key functional components."""
    results: Dict[str, Any] = defaultdict(list)
    try:
        code = path.read_text(encoding='utf-8', errors='ignore')

        # Find function definitions
        for match in RE_DEFINITIONS.finditer(code):
            # The name can be in any of the capturing groups
            name = next((g for g in match.groups() if g is not None), None)
            if name and name not in results['functions']:
                results['functions'].append(name)

        # Find Firestore collection names
        for match in RE_FIRESTORE_QUERIES.finditer(code):
            collection_name = match.group(1)
            if collection_name not in results['firestore_collections']:
                results['firestore_collections'].append(collection_name)
        
        # Find HTML element IDs it interacts with
        for match in RE_GET_ELEMENT_BY_ID.finditer(code):
            element_id = match.group(1)
            if element_id not in results['element_ids']:
                results['element_ids'].append(element_id)

    except Exception as e:
        print(f"Error analyzing {path}: {e}")
        return {}

    # Sort for consistent output
    for key in results:
        results[key] = sorted(list(set(results[key])))
        
    return results

def main():
    """Main function to run the analysis and print the report."""
    print(colour("🚀 Analyzing Town Hall JavaScript Files...", GREEN))

    if not TOWNHALL_JS_DIR.exists():
        print(f"Error: Directory not found at {TOWNHALL_JS_DIR}")
        return

    # Iterate over the specified JS files
    for filename in os.listdir(TOWNHALL_JS_DIR):
        if filename.endswith('.js'):
            fpath = TOWNHALL_JS_DIR / filename
            print(f"\n--- 📄 {fpath} ---\n")
            
            analysis = analyze_js_file(fpath)

            if analysis.get('functions'):
                print(colour("  Functionality:", YELLOW))
                for func in analysis['functions']:
                    print(f"    - Defines function: `{func}`")

            if analysis.get('firestore_collections'):
                print(colour("\n  Database Interaction:", YELLOW))
                for coll in analysis['firestore_collections']:
                    print(f"    - Accesses Firestore collection: `{coll}`")

            if analysis.get('element_ids'):
                print(colour("\n  HTML Interaction:", YELLOW))
                for el_id in analysis['element_ids']:
                    print(f"    - Interacts with HTML element ID: `#{el_id}`")
            
            if not analysis:
                print("    (No specific functionality detected)")

    print(colour("\n✅ Analysis Complete.", GREEN))

if __name__ == '__main__':
    main()

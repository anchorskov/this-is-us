# scripts/hugo-section-comparison.py
"""
A diagnostic tool to compare the content and layout structure of two
different sections within a Hugo project. This helps identify and
resolve inconsistencies in rendering and styling.

Usage:
    python scripts/hugo-section-comparison.py events townhall
"""
from __future__ import annotations
import argparse
import os
import re
from pathlib import Path

# --- ANSI Colors for Readability ---
GREEN = '\u001b[32m'
RED = '\u001b[31m'
YELLOW = '\u001b[33m'
CYAN = '\u001b[36m'
RESET = '\u001b[0m'

def colour(text: str, col: str) -> str:
    """Applies ANSI color codes to text."""
    return f"{col}{text}{RESET}"

def get_front_matter_keys(content: str) -> dict[str, str]:
    """Parses front matter to get key-value pairs."""
    fm = {}
    in_front_matter = False
    for line in content.splitlines():
        if line.strip() == '---':
            if fm and in_front_matter:
                break
            in_front_matter = True
            continue
        if in_front_matter:
            match = re.match(r'^\s*(\w+)\s*[:=]\s*(.*)', line)
            if match:
                fm[match.group(1).strip()] = match.group(2).strip().strip("'\"")
    return fm

def analyze_section(section_name: str) -> dict:
    """Gathers structural information about a given section."""
    analysis = {
        "name": section_name,
        "content_index": None,
        "layout_list": None,
        "layout_single": None,
        "front_matter": {},
        "errors": []
    }

    # 1. Analyze Content Structure
    content_path = Path(f"content/{section_name}")
    if not content_path.exists():
        analysis["errors"].append(f"Content directory `content/{section_name}` not found.")
        return analysis

    if (content_path / "_index.md").exists():
        analysis["content_index"] = "_index.md (Section List Page)"
        try:
            content = (content_path / "_index.md").read_text()
            analysis["front_matter"] = get_front_matter_keys(content)
        except Exception as e:
            analysis["errors"].append(f"Could not read _index.md: {e}")

    elif (content_path / "index.md").exists():
        analysis["content_index"] = "index.md (Leaf Bundle / Single Page)"
        try:
            content = (content_path / "index.md").read_text()
            analysis["front_matter"] = get_front_matter_keys(content)
        except Exception as e:
            analysis["errors"].append(f"Could not read index.md: {e}")
    else:
        analysis["errors"].append("No `_index.md` or `index.md` found.")

    # 2. Analyze Layout Structure
    layout_path = Path(f"layouts/{section_name}")
    if (layout_path / "list.html").exists():
        analysis["layout_list"] = f"layouts/{section_name}/list.html"
    if (layout_path / "single.html").exists():
        analysis["layout_single"] = f"layouts/{section_name}/single.html"
        
    return analysis

def print_comparison(analysis1: dict, analysis2: dict):
    """Prints a side-by-side comparison of the two section analyses."""
    print("-" * 70)
    print(f"{colour(analysis1['name'].upper(), CYAN):^34} | {colour(analysis2['name'].upper(), CYAN):^34}")
    print("-" * 70)

    # Content Structure
    c1 = analysis1.get('content_index', 'N/A')
    c2 = analysis2.get('content_index', 'N/A')
    marker = "✅" if c1 == c2 else "❌"
    print(f"{'Content File:':<15} {c1:<25} | {c2:<25} {colour(marker, GREEN if marker=='✅' else RED)}")

    # Front Matter Comparison
    fm1 = analysis1.get('front_matter', {})
    fm2 = analysis2.get('front_matter', {})
    all_fm_keys = sorted(list(set(fm1.keys()) | set(fm2.keys())))
    if all_fm_keys:
        print(colour("\n--- Front Matter ---", YELLOW))
        for key in all_fm_keys:
            v1 = fm1.get(key, "not set")
            v2 = fm2.get(key, "not set")
            marker = "✅" if v1 == v2 else "❌"
            print(f"{f'{key}:':<15} {v1:<25} | {v2:<25} {colour(marker, GREEN if marker=='✅' else RED)}")

    # Layout Files
    print(colour("\n--- Layout Files ---", YELLOW))
    # THIS IS THE FIX: Use .get() with a default value to prevent the TypeError
    l_list1 = analysis1.get('layout_list', 'not found')
    l_list2 = analysis2.get('layout_list', 'not found')
    marker = "✅" if (l_list1 != 'not found' and l_list2 != 'not found') or (l_list1 == 'not found' and l_list2 == 'not found') else "❌"
    print(f"{'List Layout:':<15} {str(l_list1):<25} | {str(l_list2):<25} {colour(marker, GREEN if marker=='✅' else RED)}")
    
    l_single1 = analysis1.get('layout_single', 'not found')
    l_single2 = analysis2.get('layout_single', 'not found')
    marker = "✅" if (l_single1 != 'not found' and l_single2 != 'not found') or (l_single1 == 'not found' and l_single2 == 'not found') else "❌"
    print(f"{'Single Layout:':<15} {str(l_single1):<25} | {str(l_single2):<25} {colour(marker, GREEN if marker=='✅' else RED)}")

    # Errors
    if analysis1['errors'] or analysis2['errors']:
        print(colour("\n--- Errors ---", RED))
        for err in analysis1['errors']: print(f"{analysis1['name']}: {err}")
        for err in analysis2['errors']: print(f"{analysis2['name']}: {err}")
        
    print("-" * 70)


def main():
    """Main function to run the comparison."""
    parser = argparse.ArgumentParser(description="Compare the structure of two Hugo sections.")
    parser.add_argument("section1", help="Name of the first section (e.g., events)")
    parser.add_argument("section2", help="Name of the second section (e.g., townhall)")
    args = parser.parse_args()

    print(colour(f"Comparing sections '{args.section1}' and '{args.section2}'...", GREEN))
    
    analysis1 = analyze_section(args.section1)
    analysis2 = analyze_section(args.section2)
    
    print_comparison(analysis1, analysis2)

if __name__ == "__main__":
    main()

# scan_hugo_md.py
# 📄 Scans all .md files under `content/` and logs front matter details

import os
import frontmatter
from pathlib import Path

content_dir = Path("content")
output_path = Path("hugos-path.md")
results = []

for md_file in content_dir.rglob("*.md"):
    try:
        post = frontmatter.load(md_file)
        title = post.get('title', 'Untitled')
        type_ = post.get('type', 'None')
        layout = post.get('layout', 'None')
        url = post.get('url', f'/{md_file.relative_to(content_dir).with_suffix("")}/')

        results.append(f"- **File**: `{md_file}`\n  - Title: {title}\n  - Type: `{type_}`\n  - Layout: `{layout}`\n  - URL: `{url}`\n")
    except Exception as e:
        results.append(f"- **File**: `{md_file}`\n  - ❌ Error parsing front matter: {e}")

with open(output_path, "w", encoding="utf-8") as f:
    f.write("# Hugo Content File Summary\n\n")
    f.write("\n".join(results))

print(f"✅ Report written to: {output_path}")

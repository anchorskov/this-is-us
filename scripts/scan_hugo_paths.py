from pathlib import Path
import frontmatter
from collections import defaultdict

# Directories
content_dir = Path("content")
layouts_dir = Path("layouts")
output_path = Path("hugos-path.md")

# Store grouped results
grouped_content = defaultdict(list)
layout_files = {p.relative_to(layouts_dir).as_posix() for p in layouts_dir.rglob("*.html")}
used_layouts = set()

# Scan content files and group by folder
for md_file in content_dir.rglob("*.md"):
    try:
        post = frontmatter.load(md_file)
        title = post.get('title', 'Untitled')
        type_ = post.get('type', 'None')
        layout = post.get('layout', 'None')
        url = post.get('url', f'/{md_file.relative_to(content_dir).with_suffix("")}/')

        expected_layouts = []
        if type_ != 'None' and layout != 'None':
            expected_layouts.append(f"{type_}/{layout}.html")
        if type_ != 'None':
            expected_layouts.append(f"{type_}/single.html")
        if layout != 'None':
            expected_layouts.append(f"_default/{layout}.html")
        expected_layouts.append("_default/single.html")

        matched_layout = next((l for l in expected_layouts if l in layout_files), "❌ No matching layout")
        if matched_layout != "❌ No matching layout":
            used_layouts.add(matched_layout)

        relative_folder = md_file.parent.relative_to(content_dir).as_posix()
        grouped_content[relative_folder].append({
            "file": md_file.name,
            "title": title,
            "type": type_,
            "layout": layout,
            "url": url,
            "matched_layout": matched_layout
        })
    except Exception as e:
        grouped_content["errors"].append({
            "file": str(md_file),
            "error": str(e)
        })

# Unused layouts
unused_layouts = sorted(layout_files - used_layouts)

# Write results
with open(output_path, "w", encoding="utf-8") as f:
    f.write("# Hugo Content File Summary (Grouped by Folder)\n\n")

    for folder, files in sorted(grouped_content.items()):
        f.write(f"## 📁 `{folder or './'}`\n\n")
        for entry in files:
            if "error" in entry:
                f.write(f"- **File**: `{entry['file']}`\n  - ❌ Error: {entry['error']}\n")
            else:
                f.write(f"- **File**: `{entry['file']}`\n")
                f.write(f"  - Title: {entry['title']}\n")
                f.write(f"  - Type: `{entry['type']}`\n")
                f.write(f"  - Layout: `{entry['layout']}`\n")
                f.write(f"  - URL: `{entry['url']}`\n")
                f.write(f"  - Matched Layout: `{entry['matched_layout']}`\n\n")

    f.write("\n---\n\n## 🧩 All Layout Templates Found\n\n")
    for layout in sorted(layout_files):
        f.write(f"- `{layout}`\n")

    f.write("\n---\n\n## ⚠️ Unused Layout Templates\n\n")
    for layout in unused_layouts:
        f.write(f"- `{layout}`\n")

print("✅ Summary written to hugos-path.md")

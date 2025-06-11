# scripts/summarize-logic-v3.3.py

import os
import re
import frontmatter

BASE_DIR = '.'
TARGET_EXTENSIONS = ['.js', '.html', '.mjs', '.py', '.md', '.toml', '.sql']
IGNORED_DIRS = {
    'node_modules', '__pycache__', 'bin', 'lib', '.git', 'venv',
    'static/admin', 'themes', 'public', '.wrangler', '.pytest_cache',
    '.parcel-cache', '.idea', '.vscode', 'build', 'dist'
}
IGNORED_PATH_PARTS = ['/tmp/', '/test/', '/bundle-']
IGNORED_EXTENSIONS = ['.bak', '.tmp', '.log']

output = []

def extract_summary(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            summary = []
            for line in lines:
                if line.strip().startswith(('//', '#', '--', '/*')):
                    summary.append(line.strip())
                else:
                    break
            return ' '.join(summary) if summary else '(no summary)'
    except Exception:
        return '(unreadable)'

def extract_definitions(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            code = f.read()
        defs = set()
        # Python functions and classes
        defs.update(re.findall(r'^\s*def\s+(\w+)', code, re.MULTILINE))
        defs.update(re.findall(r'^\s*class\s+(\w+)', code, re.MULTILINE))
        # JS/HTML exports or functions
        defs.update(re.findall(r'function\s+(\w+)', code))
        defs.update(re.findall(r'export function\s+(\w+)', code))
        return sorted(defs) if defs else ['(no defs)']
    except Exception:
        return ['(unreadable)']

def should_ignore(path):
    lower = path.lower()
    if any(p in lower for p in IGNORED_PATH_PARTS):
        return True
    if any(lower.endswith(ext) for ext in IGNORED_EXTENSIONS):
        return True
    return False

def walk_directory(base):
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for file in files:
            if any(file.endswith(ext) for ext in TARGET_EXTENSIONS):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base)
                if should_ignore(rel_path):
                    continue
                summary = extract_summary(full_path)
                defs = extract_definitions(full_path)
                output.append(f"\n### `{rel_path}`\n\n**Summary**: {summary}\n\n**Definitions**:\n" + '\n'.join([f"- `{d}`" for d in defs]) + '\n')

def check_layout_coverage():
    sections = set()
    for root, dirs, files in os.walk("content"):
        for file in files:
            if file.endswith(".md"):
                section = os.path.relpath(root, "content").split(os.sep)[0]
                sections.add(section)
    output.append("\n## 🧱 Layout Check – Do content sections have layout files?\n")
    for section in sorted(sections):
        layout_path = f"layouts/{section}/single.html"
        found = os.path.exists(layout_path)
        output.append(f"- `{layout_path}` → {'✅ Found' if found else '❌ Missing'}")

def list_townhall_threads():
    townhall_path = "content/townhall/thread"
    if not os.path.exists(townhall_path):
        return
    output.append("\n## 🗂 Town Hall Pages (Expected URLs)\n")
    for root, dirs, files in os.walk(townhall_path):
        for file in files:
            if file.endswith(".md"):
                full_path = os.path.join(root, file)
                try:
                    post = frontmatter.load(full_path)
                    slug = post.get("slug", None)
                    filename = os.path.splitext(file)[0]
                    route = slug if slug else filename
                    output.append(f"- `/townhall/thread/{route}`")
                except Exception:
                    output.append(f"- {file} → (⚠️ unreadable frontmatter)")

if __name__ == '__main__':
    walk_directory(BASE_DIR)
    check_layout_coverage()
    list_townhall_threads()
    with open('logic-index-v3.md', 'w', encoding='utf-8') as f:
        f.write("# Logic Index – This Is Us Project (v3.3)\n")
        f.write('\n'.join(output))
        print("✅ logic-index-v3.md generated (v3.3)")

import os
import zipfile
import shutil
from pathlib import Path

# Windows Downloads folder path
windows_zip_path = Path("/mnt/c/Users/ancho/Downloads/this-is-us-hugo-final.zip")

# Target WSL Hugo project path
project_path = Path("/home/anchor/projects/this-is-us")
temp_extract_path = project_path / "tmp"

# Validate zip file
if not windows_zip_path.exists():
    print(f"❌ ZIP not found at {windows_zip_path}")
    exit()

# Clean up temp folder if it exists
if temp_extract_path.exists():
    shutil.rmtree(temp_extract_path)
temp_extract_path.mkdir(parents=True, exist_ok=True)

# Extract ZIP to temp path
with zipfile.ZipFile(windows_zip_path, 'r') as zip_ref:
    zip_ref.extractall(temp_extract_path)
print("✅ Extracted ZIP to temp folder")

# Copy content/ folder
content_src = temp_extract_path / "content"
content_dest = project_path / "content"

if content_dest.exists():
    shutil.rmtree(content_dest)
shutil.copytree(content_src, content_dest)
print("📁 Copied content/ to Hugo project")

# Copy config.toml
config_src = temp_extract_path / "config.toml"
config_dest = project_path / "config.toml"
shutil.copy2(config_src, config_dest)
print("⚙️ Updated config.toml")

# Clean up temp folder
shutil.rmtree(temp_extract_path)

print("🎉 Site setup complete! You can now run: hugo server -D")

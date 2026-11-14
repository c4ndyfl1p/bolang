#!/usr/bin/env bash
# Builds the zip to upload to addons.mozilla.org: dist/bolang-<version>.zip
# manifest.json must be at the TOP of the zip (not inside a folder), so we zip from inside the folder.
set -euo pipefail
cd "$(dirname "$0")/../chrome-extention"

version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
out="../dist/bolang-$version.zip"
mkdir -p ../dist
rm -f "$out"

# Only the files the extension needs; nothing else gets shipped
zip -q -r "$out" manifest.json content.js popup.html popup.css popup.js icons/

echo "Built dist/bolang-$version.zip:"
unzip -l "$out"

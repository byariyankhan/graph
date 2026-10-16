#!/bin/bash
# DocuGraph installer for macOS (unsigned / developer mode).
set -e
SRC="$(cd "$(dirname "$0")/../extension" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.docugraph.ae"
echo "Installing DocuGraph to $DEST"
rm -rf "$DEST"; mkdir -p "$(dirname "$DEST")"; cp -R "$SRC" "$DEST"
for v in 9 10 11 12 13; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
echo "Done. Restart After Effects, then open Window > Extensions > DocuGraph."

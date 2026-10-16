#!/bin/bash
# Rebuilds extension/client/js/vendor/anthropic.js from the official
# Anthropic TypeScript SDK (used by the panel's optional "Generate with Claude").
set -e
DIR="$(mktemp -d)"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" && npm init -y >/dev/null && npm install @anthropic-ai/sdk esbuild >/dev/null
printf 'import Anthropic from "@anthropic-ai/sdk";\nwindow.Anthropic = Anthropic;\n' > entry.js
npx esbuild entry.js --bundle --format=iife --target=chrome88 --minify --outfile=bundle.js
VER=$(grep '"version"' node_modules/@anthropic-ai/sdk/package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
(printf '/* @anthropic-ai/sdk %s (MIT) — browser bundle, rebuild with tools/build-sdk.sh. Exposes window.Anthropic. */\n' "$VER"; cat bundle.js) > "$ROOT/extension/client/js/vendor/anthropic.js"
echo "built SDK $VER"

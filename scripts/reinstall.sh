#!/usr/bin/env bash
set -euo pipefail

PI_ME_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "==> Reinstalling pi-me at $PI_ME_DIR"

cd "$PI_ME_DIR"

echo "==> Removing node_modules and lockfile..."
rm -rf node_modules package-lock.json

echo "==> Running npm install..."
npm install

echo "==> Running tests..."
npm test

echo "==> Done. pi-me reinstalled successfully."

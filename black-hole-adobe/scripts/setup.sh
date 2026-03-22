#!/usr/bin/env bash
set -euo pipefail

# Black Hole for Adobe Marketing Cloud — First-time setup
# Usage: bash scripts/setup.sh

REQUIRED_NODE_MAJOR=20

echo "================================================"
echo "  Black Hole for Adobe Marketing Cloud — Setup"
echo "================================================"
echo

# 1. Check Node.js version
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "       Install Node.js $REQUIRED_NODE_MAJOR+ from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo "ERROR: Node.js $REQUIRED_NODE_MAJOR+ is required (found v$(node -v))."
  exit 1
fi
echo "[ok] Node.js $(node -v)"

# 2. Install dependencies
echo
echo "Installing dependencies..."
npm ci
echo "[ok] Dependencies installed"

# 3. Create data directories
echo
echo "Creating data directories..."
mkdir -p data/uploads
echo "[ok] data/ and data/uploads/ created"

# 4. Copy .env.example -> .env (if .env does not already exist)
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[ok] .env created from .env.example — edit it to add your keys"
else
  echo "[skip] .env already exists"
fi

# 5. Run database migrations (if a migrate script exists)
if npm run --silent 2>/dev/null | grep -q "^  db:migrate$"; then
  echo
  echo "Running database migrations..."
  npm run db:migrate
  echo "[ok] Migrations complete"
else
  echo "[skip] No db:migrate script found — skipping migrations"
fi

# 6. Done
echo
echo "================================================"
echo "  Setup complete! Start the dev server with:"
echo ""
echo "    npm run dev"
echo ""
echo "  Then open http://localhost:3000"
echo "================================================"

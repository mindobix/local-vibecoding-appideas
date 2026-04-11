#!/usr/bin/env bash
# ─── install-hooks.sh ─────────────────────────────────────────────────────────
# Installs the post-commit git hook into every vibecode app repo.
# Safe to run repeatedly — never overwrites a hook that wasn't ours.
#
# Usage (from anywhere):
#   bash /path/to/local-vibecoding-appideas/tools/install-hooks.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"       # …/local-vibecoding-appideas/tools
APPIDEAS_DIR="$(cd "$TOOLS_DIR/.." && pwd)"       # …/local-vibecoding-appideas
VIBECODE_DIR="$(cd "$APPIDEAS_DIR/.." && pwd)"    # …/vibecode

# ── The hook body ─────────────────────────────────────────────────────────────
# Uses a path relative to the repo root so it works no matter where the
# vibecode directory lives on any machine.
hook_body() {
cat <<'HOOK'
#!/usr/bin/env bash
# VibeCoding commit-card hook — auto-generated, do not edit manually.
# To remove: delete this file or remove everything below the shebang.
SCRIPT="$(git rev-parse --show-toplevel)/../local-vibecoding-appideas/tools/commit-card.js"
if [ -f "$SCRIPT" ]; then
  node "$SCRIPT" || true   # never block the commit
fi
HOOK
}

OUR_MARKER='VibeCoding commit-card hook'

installed=0
skipped=0

for dir in "$VIBECODE_DIR"/*/; do
  # Only directories that are git repos
  [ -d "$dir/.git" ] || continue

  app="$(basename "$dir")"

  # Skip the appideas app itself — it IS the destination
  [ "$app" = "local-vibecoding-appideas" ] && continue

  hook_file="$dir/.git/hooks/post-commit"

  # If a hook already exists and isn't ours, leave it alone
  if [ -f "$hook_file" ] && ! grep -q "$OUR_MARKER" "$hook_file" 2>/dev/null; then
    echo "  ⚠  $app — post-commit hook exists (not ours), skipping"
    (( skipped++ )) || true
    continue
  fi

  hook_body > "$hook_file"
  chmod +x "$hook_file"
  echo "  ✓  $app"
  (( installed++ )) || true
done

echo ""
echo "Done. Installed/updated: $installed   Skipped (foreign hooks): $skipped"
echo ""
echo "Each commit in a vibecode app will now append a card to:"
echo "  $VIBECODE_DIR/local-vibecoding-appideas/data/incoming/pending.json"
echo ""
echo "Open the VibeCoding App Ideas app and click  ⬇ Import Commits  to review them."

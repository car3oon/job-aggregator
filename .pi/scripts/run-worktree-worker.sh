#!/usr/bin/env bash
set -euo pipefail

WORKTREE_DIR="${1:-$(pwd)}"
MODEL="${1:-claude-sonnet-4-6}"
AGENT_NAME="sources-grouping-worker"

# 1. Split a pane in Herdr
PANE_JSON=$(herdr pane split --direction right --ratio 0.45 2>&1)
PANE_ID=$(echo "$PANE_JSON" | grep -o '"pane_id":"[^"]*"' | head -n 1 | cut -d'"' -f4)

if [ -z "$PANE_ID" ]; then
  echo "Failed to split pane in Herdr: $PANE_JSON"
  exit 1
fi

cleanup() {
  herdr pane close "$PANE_ID" 2>/dev/null || true
}
trap cleanup EXIT

sleep 0.5
herdr agent start "$AGENT_NAME" --kind pi --pane "$PANE_ID" -- --model "$MODEL"

sleep 1.5

PROMPT="You are working strictly inside the git worktree: ${WORKTREE_DIR}
Task: Group Scraping Sources by portal in the sidebar (src/app/page.tsx) and optionally in Settings (src/components/ScraperUrlsManager.tsx).
Requirements:
1. Currently the sidebar renders a flat list of all scraper URLs ('theprotocol.it - React', 'theprotocol.it - Vue', 'Pracuj.pl - Next.js', etc.).
2. Group them by portal (e.g. 'theprotocol.it', 'Pracuj.pl', 'NoFluffJobs') with an accordion or expandable list of query variants (e.g. Next.js, React, Frontend), similar to JobCard related variants.
3. Keep English comments, use Tailwind CSS and lucide-react.
4. Run 'pnpm test' to verify nothing is broken.
5. Provide a summary of changes when completed."

herdr pane send-text "$PANE_ID" "$PROMPT"
sleep 0.3
herdr pane send-keys "$PANE_ID" "Enter"

sleep 3
herdr agent wait "$AGENT_NAME" --timeout 300000

# Cleanup on exit

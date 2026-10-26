#!/usr/bin/env bash
set -euo pipefail

REVIEWER_KIND="${1:-copilot}"
REPO_DIR="$(pwd)"

# 1. Split a pane in Herdr
PANE_JSON=$(herdr pane split --direction right --ratio 0.4 2>&1)
PANE_ID=$(echo "$PANE_JSON" | grep -o '"pane_id":"[^"]*"' | head -n 1 | cut -d'"' -f4)

if [ -z "$PANE_ID" ]; then
  echo "Failed to split pane in Herdr: $PANE_JSON"
  exit 1
fi

AGENT_NAME="${REVIEWER_KIND}-reviewer"

# Trap to guarantee pane closure on exit
cleanup() {
  herdr pane close "$PANE_ID" 2>/dev/null || true
}
trap cleanup EXIT

# 2. Wait for pane readiness and start agent
sleep 0.5
herdr agent start "$AGENT_NAME" --kind "$REVIEWER_KIND" --pane "$PANE_ID"

# Handle first-time prompts/trust dialogs if any appear
sleep 0.5
STATE=$(herdr agent get "$AGENT_NAME" 2>&1 || true)
if echo "$STATE" | grep -q '"agent_status":"blocked"'; then
  # Auto-confirm trust/folder approval in terminal
  herdr pane send-keys "$PANE_ID" "Down" && sleep 0.1 && herdr pane send-keys "$PANE_ID" "Enter"
  sleep 0.5
fi

# 3. Submit review prompt
PROMPT="Review all uncommitted git changes in this repository (${REPO_DIR}), including modified and untracked files.
Inspect the changes directly in this process without recursive delegation.
If an active Hunk session is present (check via 'hunk session list --json'), add inline findings via:
hunk session comment add --repo . --file <file> --new-line <line> --summary '<short title>' --rationale '<explanation>' --author '${REVIEWER_KIND}'
Conclude with a clear verdict (OK or Changes requested) and bulleted findings."

herdr agent prompt "$AGENT_NAME" "$PROMPT"

# 4. Wait for completion in background
herdr agent wait "$AGENT_NAME" --timeout 180000

# 5. Capture final output
OUTPUT_FILE="/tmp/herdr-review-${REVIEWER_KIND}.log"
herdr pane read "$PANE_ID" > "$OUTPUT_FILE" 2>&1 || true

# Pane will be closed automatically by trap cleanup on exit

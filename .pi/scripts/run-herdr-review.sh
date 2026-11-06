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

# 2. Wait for pane readiness and start agent
sleep 0.5
if ! herdr agent start "$AGENT_NAME" --kind "$REVIEWER_KIND" --pane "$PANE_ID"; then
  herdr pane read "$PANE_ID" > "/tmp/herdr-review-${REVIEWER_KIND}.log"
  echo "Agent failed to start. Pane $PANE_ID remains open for inspection." >&2
  exit 1
fi

sleep 0.5
STATE=$(herdr agent get "$AGENT_NAME")
if echo "$STATE" | grep -q '"agent_status":"blocked"'; then
  herdr pane read "$PANE_ID" > "/tmp/herdr-review-${REVIEWER_KIND}.log"
  echo "Agent is blocked. Pane $PANE_ID remains open; inspect and respond manually." >&2
  exit 1
fi

# 3. Submit review prompt
PROMPT="Review all uncommitted git changes in this repository (${REPO_DIR}), including modified and untracked files.
Inspect the changes directly in this process without recursive delegation.
If an active Hunk session is present (check via 'hunk session list --json'), add inline findings via:
hunk session comment add --repo . --file <file> --new-line <line> --summary '<short title>' --rationale '<explanation>' --author '${REVIEWER_KIND}'
Conclude with a clear verdict (OK or Changes requested) and bulleted findings."

herdr agent prompt "$AGENT_NAME" "$PROMPT"

# 4. Wait for completion
herdr agent wait "$AGENT_NAME" --timeout 180000

# 5. Capture final output
OUTPUT_FILE="/tmp/herdr-review-${REVIEWER_KIND}.log"
herdr pane read "$PANE_ID" > "$OUTPUT_FILE" 2>&1 || true

herdr pane close "$PANE_ID" 2>/dev/null || true
echo "Review finished. Pane $PANE_ID closed."

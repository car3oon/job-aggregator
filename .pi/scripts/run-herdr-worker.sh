#!/usr/bin/env bash
set -euo pipefail

MODEL="${1:-claude-sonnet-4-6}"
AGENT_NAME="fix-worker"

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

# 2. Start Pi with selected model
sleep 0.5
herdr agent start "$AGENT_NAME" --kind pi --pane "$PANE_ID" -- --model "$MODEL"

sleep 1.5

# 3. Prompt instructions
PROMPT="You are an expert engineer resolving code review findings.
1. Query active Hunk review comments: hunk session comment list --repo . --json
2. Apply the necessary code fixes to address all valid findings.
3. Run tests using 'pnpm test' to verify that everything passes without regressions.
4. For each addressed finding, resolve it in Hunk:
   hunk session comment add --repo . --reply-to <comment-id> --summary 'Resolved: <fix details>' --author 'Worker'
5. Provide a summary of applied fixes. When done, output: FIXES_COMPLETED"

# Send prompt to Pi interactive editor
herdr pane send-text "$PANE_ID" "$PROMPT"
sleep 0.3
herdr pane send-keys "$PANE_ID" "Enter"

# 4. Wait while agent enters working state, then wait until it returns to idle/done
sleep 3
herdr agent wait "$AGENT_NAME" --timeout 300000

# 5. Capture final output
OUTPUT_FILE="/tmp/herdr-worker-${MODEL}.log"
herdr pane read "$PANE_ID" > "$OUTPUT_FILE" 2>&1 || true

# Pane will be automatically closed by the trap on exit

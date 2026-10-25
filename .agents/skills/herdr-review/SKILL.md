---
name: herdr-review
description: Multi-agent code review workflow using Herdr CLI and Hunk diff viewer. Triggers on "code review", "review changes", "zleć review", "reviewer".
---

# Herdr & Hunk Multi-Agent Code Review Skill

This skill defines the workflow for delegating code reviews to another agent (e.g. `reviewer` running GitHub Copilot CLI or another LLM) in the Herdr terminal multiplexer, optionally integrating with a running Hunk diff review session (`hunk diff --watch --agent-notes`).

## Prerequisites Check
Always verify Herdr environment before attempting orchestration:
```bash
test "${HERDR_ENV:-}" = 1
```

## Review Workflow

### 1. Check for Active Hunk Session
Check if a local Hunk TUI session is currently running:
```bash
hunk session list
```

### 2. Dispatch Prompt to Reviewer Agent
Send instructions to the target reviewer (by name `reviewer` or pane ID):

#### Case A: Hunk is running
Instruct the reviewer to attach inline notes directly into Hunk:
```bash
herdr agent prompt reviewer "Review the uncommitted changes in git diff.
For each finding, add an inline comment directly to Hunk:
hunk session comment add --repo . --file <file> --new-line <line> --summary '<title>' --rationale '<explanation>' --author 'Reviewer'
Conclude with a brief 2-3 sentence verdict in the terminal."
```

#### Case B: Hunk is not running
Instruct the reviewer to output a structured markdown review in its terminal:
```bash
herdr agent prompt reviewer "Review the uncommitted changes in git diff.
Provide a structured Code Review report containing:
1. Verdict (Ready to commit / Changes requested)
2. Strengths & Highlights
3. Critical issues & edge cases (with file:line references)
4. Recommended improvements."
```

### 3. Asynchronously Wait for Reviewer
Wait until the agent returns to `idle` or `done`:
```bash
herdr agent wait reviewer --timeout 120000
```

### 4. Read & Summarize Findings
Once the wait command finishes, read the terminal output:
```bash
herdr agent read reviewer
```
Extract the key findings, verdict, and action items, and provide a clear, concise summary in chat for the user.

### 5. Resolving Comments After Fixes
CRITICAL: Automatically resolve ONLY the specific comments that were addressed by the code changes. Do NOT resolve skipped, deferred, or unaddressed comments.
1. Query active comments: `hunk session comment list --repo . --json`
2. Match each fix to its respective `commentId`.
3. Resolve each matched comment individually:
- **Threaded Resolution (Recommended for audit trail)**:
  Post an inline reply to the finding in Hunk explaining how it was fixed:
  ```bash
  hunk session comment add --repo . --reply-to <comment-id> --summary "Resolved: <fix details>" --author "Antigravity"
  ```
- **Dismissal / Removal (Clean diff view)**:
  Delete the resolved comment so it clears out of the Hunk review stream:
  ```bash
  hunk session comment rm --repo . <comment-id>
  ```
- **Batch Clear**:
  Clear all agent comments once the entire changeset is approved:
  ```bash
  hunk session comment clear --repo . --yes
  ```


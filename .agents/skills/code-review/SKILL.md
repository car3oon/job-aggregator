---
name: code-review
description: Multi-agent code review workflow running Copilot or Codex in Herdr background pane and posting inline comments to Hunk diff. Triggers on "code review", "review changes", "review with copilot", "review with codex".
---

# Multi-Agent Code Review Skill (Copilot / Codex in Herdr Background & Hunk)

This skill defines the workflow for running Code Reviews in a visible, dedicated **Herdr** pane as a background job, posting inline annotations to **Hunk**, and automatically closing the reviewer pane upon completion.

## Triggering the Review
When the user asks for a code review:
- Target: `copilot` (GitHub Copilot CLI) or `codex` (OpenAI Codex CLI). If unspecified, ask the user.
- Execute the background wrapper:
  ```bash
  .pi/scripts/run-herdr-review.sh copilot > /dev/null 2>&1 &
  # or
  .pi/scripts/run-herdr-review.sh codex > /dev/null 2>&1 &
  ```
- Inform the user immediately that the review is running in the background, visible in Herdr's **Agents** sidebar (`copilot-reviewer` or `codex-reviewer`), and that the chat is fully available for other work.
- When the job finishes, the pane automatically closes. Any findings are queryable in Hunk:
  ```bash
  hunk session comment list --repo . --json
  ```

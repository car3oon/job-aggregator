<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Global Project Rules

- **Language Constraint:** ALWAYS write code comments, commit messages, console logs, and internal documentation in English. Polish is ONLY permitted in direct chat conversations with the user. Absolutely NO Polish text is allowed inside codebase files.
- **Package Manager:** Use `pnpm`. Do NOT use `npm` or `yarn`.
- **UI/Styling:** Use Tailwind CSS and `lucide-react` for icons. Favor minimalist design.
- **Scraper Engine:** The text matching logic requires comma `,` for OR and plus `+` for AND combinations (e.g. `react + fullstack`).

## Multi-Agent Code Review Workflow (Herdr & Hunk)

The workflow lives in global skills, not in this repository. Do not add project-local copies of the launchers, commands, or reviewer agents; they would drift from the installed versions.

- **Canonical skills:** `hunk-herdr-review` (review) and `hunk-herdr-fix` (fix findings) in `~/.agents/skills/`.
- **Review Delegation:** When requested to perform a code review using OpenCode, Copilot, or Codex:
  1. Determine the reviewer (`opencode`, `copilot`, or `codex`). Ask if the user did not choose one.
  2. Start the non-blocking global launcher: `bash ~/.agents/skills/hunk-herdr-review/scripts/start-herdr-review.sh <opencode|copilot|codex>`. The `/code-review-pane` command does the same from any project.
  3. The reviewer appears in Herdr's **Agents** sidebar with its own terminal pane; the main chat stays free and interactive.
  4. Findings are posted to Hunk (`hunk session comment add`).
  5. The runner writes a completion state to `/tmp/herdr-review-<reviewer>.status` and terminal output to `/tmp/herdr-review-<reviewer>.log`. Poll the status file for `completed`, `failed`, `blocked`, or `timeout`. Override the wait with `HERDR_REVIEW_TIMEOUT_MS` when a review needs longer. The pane stays open after completion or failure for inspection.
- **Fixing findings:** Start `bash ~/.agents/skills/hunk-herdr-fix/scripts/start-herdr-fix.sh <provider>` (or `/fix-review-findings-pane`) and follow the `hunk-herdr-fix` skill. After applying fixes, resolve ONLY the specific comments that were addressed (via `hunk session comment add --repo . --reply-to <id>` or dismissal `hunk session comment rm --repo . <id>`). Never resolve unaddressed or skipped comments.

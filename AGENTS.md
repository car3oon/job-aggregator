<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Global Project Rules

- **Language Constraint:** ALWAYS write code comments, commit messages, console logs, and internal documentation in English. Polish is ONLY permitted in direct chat conversations with the user. Absolutely NO Polish text is allowed inside codebase files.
- **Package Manager:** Use `pnpm`. Do NOT use `npm` or `yarn`.
- **UI/Styling:** Use Tailwind CSS and `lucide-react` for icons. Favor minimalist design.
- **Scraper Engine:** The text matching logic requires comma `,` for OR and plus `+` for AND combinations (e.g. `react + fullstack`).

## Multi-Agent Code Review Workflow (Copilot / Codex in Herdr & Hunk)

- **Review Delegation:** When requested to perform a code review using Copilot or Codex:
  1. Determine the reviewer (`copilot` or `codex`).
  2. Launch the non-blocking background runner: `.pi/scripts/run-herdr-review.sh <copilot|codex> &`.
  3. The reviewer immediately appears in Herdr's **Agents** sidebar (`copilot-reviewer` or `codex-reviewer`) with its own terminal pane.
  4. The main chat remains completely free and interactive.
  5. Findings are posted to Hunk (`hunk session comment add`).
  6. Upon completion, the runner automatically closes the reviewer pane and frees the agent slot.
  7. After applying fixes, automatically resolve ONLY the specific comments that were addressed (via `hunk session comment add --repo . --reply-to <id>` or dismissal `hunk session comment rm --repo . <id>`). Never resolve unaddressed or skipped comments.

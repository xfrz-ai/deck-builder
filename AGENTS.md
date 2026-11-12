<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Making a presentation

If the user wants a deck, presentation, pitch or proposal rather than a code change, don't edit the source code:

- **No local setup:** read [DECK-GUIDE.md](DECK-GUIDE.md) and follow it. You write a JSON deck spec that the user imports in the app.
- **Live build:** the deck tools run over MCP. The user starts them with `npm run deck-agent` (Codex) or `npm run deck-agent:claude`, as described in [docs/local-deck-agent.md](docs/local-deck-agent.md).

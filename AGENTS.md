# Project AI instructions

This is the shared entry point for AI coding tools. Keep reusable project
guidance and workflows in `ai/`; do not copy full instructions into
tool-specific configuration folders.

## Verification after extension changes

After changing browser-extension behavior, run the `yt-qa-engineer` workflow.
Its authoritative instructions are:

- `ai/skills/test-yt-quick-filters/SKILL.md`
- `ai/playbooks/yt-qa-engineer.md`

The workflow uses Playwright MCP against a live YouTrack agile board. It tests
the injected content script, not a full browser-extension installation.

## Layout

- `ai/` — version-controlled, tool-neutral source of truth.
- `.cursor/`, `.claude/`, `.codex/` — small native adapters only, one per tool.
- `.agents/skills` — not a generic fallback; it's Codex/ChatGPT's documented
  skill-discovery path (see
  https://learn.chatgpt.com/docs/build-skills), symlinked to `ai/skills`.

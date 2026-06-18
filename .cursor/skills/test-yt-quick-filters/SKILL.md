---
name: test-yt-quick-filters
description: >-
  Build and E2E-test the YouTrack Quick Filters extension via Playwright MCP
  on a live agile board. Use after code changes to verify new behavior and
  catch regressions.
---

# Test YT Quick Filters Extension

## What this skill does

Runs end-to-end checks **without** the user's Chrome or `chrome://extensions`.

Use **Playwright MCP** (`user-playwright`) to:
1. Build the extension
2. Open a public YouTrack agile board
3. Inject `dist/content.js` + CSS with a `chrome.storage` mock
4. Exercise quick filters and report pass/fail

## Hard limits

- Cannot use `chrome://extensions` in the user's desktop Chrome.
- Cannot load MV3 via `--load-extension` in MCP (sandbox blocks `require` / dynamic `import`).
- Injected test ≈ content script behavior, not full extension install.

## Default test board

```
https://youtrack.jetbrains.com/agiles/153-6143/current
```

## Workflow

```
E2E Progress:
- [ ] npm run build
- [ ] browser_close (reset polluted MCP context)
- [ ] Navigate to agile board, wait for load
- [ ] Inject extension (see reference.md — replace EXT_ROOT, pass as `code`)
- [ ] Confirm `hasFilterBar: true`
- [ ] `browser_run_code_unsafe` → critical scenarios (absolute `filename`, all `passed: true`):
  - `scripts/regression-suggestor.js`
  - `scripts/regression-toggle-off.js`
  - `scripts/regression-query-types.js`
  - `scripts/regression-days-in-status.js`
  - `scripts/regression-delete-filter.js`
- [ ] Report results
```

### Inject rules

- Read inject block from [reference.md](reference.md), substitute `EXT_ROOT` with repo root (absolute, forward slashes).
- Pass result to `browser_run_code_unsafe` as **`code`** — never `addInitScript`, never relative `dist/` paths.

### Regression scenarios

Run **after** inject via `browser_run_code_unsafe` with absolute `filename`. Each script returns `passed: true` on success.

| Script | What it checks |
|--------|----------------|
| `regression-suggestor.js` | Suggestor closes after applying `state: {In progress}` |
| `regression-toggle-off.js` | Second click on active filter clears query |
| `regression-query-types.js` | Must-pass queries apply with suggestor closed |
| `regression-days-in-status.js` | Days In Status toggles on, tags appear on cards |
| `regression-delete-filter.js` | Delete filter via context menu |

### Default regression — suggestor closes after quick filter apply

Quick run: `regression-suggestor.js`. Expect `passed: true`.

Manual / extended checks:

1. Add temp filters via modal if needed (`state: {In progress}`, `#Unresolved`, etc.)
2. Click each quick filter button in `#ytqf-bar`
3. After each click, assert suggestor is closed:

```js
() => {
  const popup = document.querySelector('[data-test="ring-popup ring-query-assist-popup"]');
  if (!popup) return { popupFound: false, popupOpen: false };
  return {
    popupFound: true,
    popupOpen: popup.getAttribute('data-test-shown') === 'true',
    dataTestShown: popup.getAttribute('data-test-shown'),
  };
}
```

**Must-pass query types:**
- `Assignee: me`
- `state: {In progress}` (braces — original bug)
- `Assignee: me State: Open`
- `#Unresolved`

Also verify toggle off (second click clears query) and rapid switching between filters.

### Other scenarios

- Quick filter modal create/edit
- Context menu duplicate/delete
- Query applied without full page reload (`?query=` in URL or input text matches)
- Days In Status tags on cards (see `regression-days-in-status.js`)

## Key DOM selectors (YouTrack)

| Element | Selector |
|---------|----------|
| Query input | `[data-test="ring-query-assist-input"]` |
| Query assist root | `[data-test="queryAssist"]` |
| **Suggestor popup** | `[data-test="ring-popup ring-query-assist-popup"]` (primary) |
| Popup fallbacks | `[data-test~="ring-query-assist-popup"]`, `.yt-search-panel__popup` |
| Popup visible flag | `data-test-shown="true"` |
| Extension bar | `#ytqf-bar`, `#ytqf-modal` |

YouTrack uses `data-test`, not `data-testid`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Redirect to `/issues` | `browser_close`, re-navigate; never stale `addInitScript` |
| Suggestor still open | Check `boardQueryApplicator.dismissQueryAssistSuggestor` |
| Search input timeout | Wait longer after board navigation |
| `require is not defined` | Use inject method, not `--load-extension` |
| `ENOENT` on `dist/` | `EXT_ROOT` must be absolute repo path, not relative |

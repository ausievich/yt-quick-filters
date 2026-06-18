# Playwright MCP reference

## Extension inject

Read the block below, replace `EXT_ROOT` with the repo root (absolute path, forward slashes), pass as `code` to `browser_run_code_unsafe`. Do not use `addInitScript`.

Requires `npm run build` first.

```javascript
async (page) => {
  const extRoot = 'EXT_ROOT';

  await page.evaluate(() => {
    const store = {};
    window.chrome = {
      runtime: { id: 'ytqf-test', onMessage: { addListener: () => {} } },
      storage: {
        sync: {
          get: (keys, cb) => {
            const result = {};
            const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});
            for (const key of list) result[key] = store[key];
            if (cb) cb(result);
            return Promise.resolve(result);
          },
          set: (items, cb) => { Object.assign(store, items); if (cb) cb(); return Promise.resolve(); },
        },
      },
    };
  });

  await page.addStyleTag({ path: `${extRoot}/dist/content.css` });
  await page.addScriptTag({ path: `${extRoot}/dist/content.js` });
  await page.waitForTimeout(3500);

  const hasFilterBar = (await page.locator('#ytqf-bar').count()) > 0;
  return { injected: true, hasFilterBar, url: page.url() };
}
```

## Default regression (suggestor closes)

Run **after** inject. Use `browser_run_code_unsafe` with `filename` (absolute path, forward slashes):

```
<workspace>/.cursor/skills/test-yt-quick-filters/scripts/regression-suggestor.js
```

Expect `passed: true`.

## Probes (`browser_evaluate`)

**Suggestor state:**

```javascript
() => {
  const popup = document.querySelector('[data-test="ring-popup ring-query-assist-popup"]');
  if (!popup) return { found: false };
  return {
    found: true,
    dataTest: popup.getAttribute('data-test'),
    dataTestShown: popup.getAttribute('data-test-shown'),
  };
}
```

**Board readiness:**

```javascript
() => ({
  url: location.href,
  hasTopBar: !!document.querySelector('div.yt-agile-board__top-bar'),
  hasQueryInput: !!document.querySelector('[data-test="ring-query-assist-input"]'),
})
```

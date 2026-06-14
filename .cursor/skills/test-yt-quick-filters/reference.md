# Playwright MCP templates

Replace `EXT_ROOT` with repo root using forward slashes.

## Inject + suggestor regression

Use with `browser_run_code_unsafe` on MCP server `user-playwright`.

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

  const popupState = () => page.evaluate(() => {
    const popup = document.querySelector('[data-test="ring-popup ring-query-assist-popup"]');
    if (!popup) return { found: false, open: false };
    return {
      found: true,
      open: popup.getAttribute('data-test-shown') === 'true',
      shown: popup.getAttribute('data-test-shown'),
    };
  });

  const addFilter = async (label, query) => {
    await page.locator('#ytqf-bar button.btn', { hasText: 'Add filter...' }).click();
    await page.waitForTimeout(300);
    await page.locator('#ytqf-name').fill(label);
    await page.locator('#ytqf-query').fill(query);
    await page.locator('#ytqf-save').click();
    await page.waitForTimeout(700);
  };

  await addFilter('QA braces', 'state: {In progress}');

  await page.locator('#ytqf-bar button.btn', { hasText: 'My Tasks' }).click();
  await page.waitForTimeout(1000);
  await page.locator('#ytqf-bar button.btn', { hasText: 'QA braces' }).click();
  await page.waitForTimeout(1300);

  return {
    hasFilterBar: await page.locator('#ytqf-bar').count() > 0,
    url: page.url(),
    popup: await popupState(),
  };
}
```

## Suggestor probe

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

## Board readiness probe

```javascript
() => ({
  url: location.href,
  hasTopBar: !!document.querySelector('div.yt-agile-board__top-bar'),
  hasQueryInput: !!document.querySelector('[data-test="ring-query-assist-input"]'),
})
```

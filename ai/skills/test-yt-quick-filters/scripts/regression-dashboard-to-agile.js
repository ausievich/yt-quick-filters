/**
 * A content script loaded on Dashboards must show filters after SPA navigation
 * to an Agile board. Run after the normal extension injection on a board.
 */
async (page) => {
  const assets = await page.evaluate(() => ({
    js: [...document.scripts].find((script) => script.textContent?.includes('ytqf-bar'))
      ?.textContent,
    css: [...document.querySelectorAll('style')].find((style) =>
      style.textContent?.includes('#ytqf-bar'),
    )?.textContent,
  }));
  if (!assets.js || !assets.css) {
    return { passed: false, reason: 'Inject the extension before running this scenario' };
  }

  await page.goto('https://youtrack.jetbrains.com/dashboard');
  await page.getByRole('link', { name: 'Agile Boards' }).waitFor({ timeout: 15000 });
  await page.getByText('Welcome to YouTrack!').waitFor({ timeout: 15000 });

  await page.evaluate(() => {
    const store = { sync: {}, local: {} };
    const storageArea = (area) => ({
      get: (keys, callback) => {
        const names = Array.isArray(keys)
          ? keys
          : typeof keys === 'string'
            ? [keys]
            : Object.keys(keys || {});
        const values = Object.fromEntries(
          names.map((name) => [name, structuredClone(store[area][name])]),
        );
        callback?.(values);
        return Promise.resolve(values);
      },
      set: (items, callback) => {
        Object.assign(store[area], structuredClone(items));
        callback?.();
        return Promise.resolve();
      },
    });
    // Keep Chrome's built-in page APIs so YouTrack's own navigation still works.
    window.chrome ??= {};
    window.chrome.runtime = {
      id: 'ytqf-dashboard-navigation-test',
      onMessage: { addListener: () => {} },
    };
    window.chrome.storage = { sync: storageArea('sync'), local: storageArea('local') };
  });

  await page.addStyleTag({ content: assets.css });
  await page.addScriptTag({ content: assets.js });
  const before = await page.evaluate(() => ({
    path: location.pathname,
    appCount: document.querySelectorAll('#ytqf-app').length,
    barCount: document.querySelectorAll('#ytqf-bar').length,
    started: window.__ytqfStarted === true,
  }));

  const marker = `ytqf-dashboard-navigation-${Date.now()}`;
  await page.evaluate((value) => {
    window.__ytqfNavigationMarker = value;
  }, marker);
  await page.getByRole('link', { name: 'Agile Boards' }).click();
  await page.locator('[data-test="ring-query-assist-input"]').waitFor({ timeout: 15000 });
  await page.locator('#ytqf-bar .ytqf-filter .lbl', { hasText: 'My Tasks' }).waitFor({
    timeout: 15000,
  });

  const after = await page.evaluate(() => ({
    path: location.pathname,
    appCount: document.querySelectorAll('#ytqf-app').length,
    barCount: document.querySelectorAll('#ytqf-bar').length,
    started: window.__ytqfStarted === true,
    marker: window.__ytqfNavigationMarker,
    filterLabels: [...document.querySelectorAll('#ytqf-bar .ytqf-filter .lbl')].map((item) =>
      item.textContent.trim(),
    ),
  }));

  return {
    before,
    after,
    passed:
      before.path === '/dashboard' &&
      before.appCount === 0 &&
      before.barCount === 0 &&
      !before.started &&
      /\/agiles\/[^/]+/.test(after.path) &&
      after.marker === marker &&
      after.appCount === 1 &&
      after.barCount === 1 &&
      after.started &&
      after.filterLabels.includes('My Tasks'),
  };
}

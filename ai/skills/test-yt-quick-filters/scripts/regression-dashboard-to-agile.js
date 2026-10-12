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

  await page.addStyleTag({ content: assets.css });
  const client = await page.context().newCDPSession(page);
  await client.send('Page.enable');
  const { frameTree } = await client.send('Page.getFrameTree');
  const { executionContextId } = await client.send('Page.createIsolatedWorld', {
    frameId: frameTree.frame.id,
    worldName: 'ytqf-dashboard-navigation-test',
    grantUniveralAccess: true,
  });

  const chromeMock = `(() => {
    const store = { sync: {}, local: {} };
    const listeners = new Set();
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
        const changes = {};
        for (const [key, value] of Object.entries(items)) {
          const oldValue = structuredClone(store[area][key]);
          store[area][key] = structuredClone(value);
          changes[key] = { oldValue, newValue: structuredClone(value) };
        }
        listeners.forEach((listener) => listener(changes, area));
        callback?.();
        return Promise.resolve();
      },
    });
    window.chrome = {
      runtime: {
        id: 'ytqf-dashboard-navigation-test',
        onMessage: { addListener: () => {} },
      },
      storage: {
        sync: storageArea('sync'),
        local: storageArea('local'),
        onChanged: {
          addListener: (listener) => listeners.add(listener),
          removeListener: (listener) => listeners.delete(listener),
        },
      },
    };
  })();`;

  const mockResult = await client.send('Runtime.evaluate', {
    contextId: executionContextId,
    expression: chromeMock,
    awaitPromise: true,
  });
  const bundleResult = await client.send('Runtime.evaluate', {
    contextId: executionContextId,
    expression: assets.js,
    awaitPromise: true,
  });
  if (mockResult.exceptionDetails || bundleResult.exceptionDetails) {
    throw new Error('Failed to inject the extension in an isolated world');
  }
  const getStarted = async () => {
    const result = await client.send('Runtime.evaluate', {
      contextId: executionContextId,
      expression: 'window.__ytqfStarted === true',
      returnByValue: true,
    });
    return result.result.value === true;
  };
  const before = {
    ...(await page.evaluate(() => ({
      path: location.pathname,
      appCount: document.querySelectorAll('#ytqf-app').length,
      barCount: document.querySelectorAll('#ytqf-bar').length,
    }))),
    started: await getStarted(),
  };

  const marker = `ytqf-dashboard-navigation-${Date.now()}`;
  await page.evaluate((value) => {
    window.__ytqfNavigationMarker = value;
  }, marker);
  await page.getByRole('link', { name: 'Agile Boards' }).click();
  await page.locator('[data-test="ring-query-assist-input"]').waitFor({ timeout: 15000 });
  await page.locator('#ytqf-bar .ytqf-filter .lbl', { hasText: 'My Tasks' }).waitFor({
    timeout: 15000,
  });

  const after = {
    ...(await page.evaluate(() => ({
      path: location.pathname,
      appCount: document.querySelectorAll('#ytqf-app').length,
      barCount: document.querySelectorAll('#ytqf-bar').length,
      marker: window.__ytqfNavigationMarker,
      filterLabels: [...document.querySelectorAll('#ytqf-bar .ytqf-filter .lbl')].map((item) =>
        item.textContent.trim(),
      ),
    }))),
    started: await getStarted(),
  };

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

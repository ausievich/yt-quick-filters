/**
 * Time badges — hidden by default, then appear and add tags when explicitly enabled.
 *
 * Use: browser_run_code_unsafe { filename: "<workspace>/.../regression-days-in-status.js" }
 */
async (page) => {
  const buttonSelector = '#ytqf-bar .ytqf-days-button';
  const hiddenByDefault = (await page.locator(buttonSelector).count()) === 0;
  const assets = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__ytqfTestAssets')));

  if (!assets?.js || !assets?.css) {
    return { hiddenByDefault, passed: false, reason: 'Missing injected extension assets' };
  }

  await page.goto('https://youtrack.jetbrains.com/agiles/153-6143/current');
  await page.locator('[data-test="ring-query-assist-input"]').waitFor({ timeout: 15_000 });

  await page.evaluate(() => {
    const syncStore = { ytqf_showDaysInStatusButton: true };
    const localStore = {};
    const storageChangeListeners = [];
    const clone = (value) => (value === undefined ? undefined : structuredClone(value));
    const createStorageArea = (store, areaName) => ({
      get: (keys, callback) => {
        const result = {};
        const names = Array.isArray(keys)
          ? keys
          : typeof keys === 'string'
            ? [keys]
            : Object.keys(keys || {});
        for (const key of names) result[key] = clone(store[key]);
        callback?.(result);
        return Promise.resolve(result);
      },
      set: (items, callback) => {
        const changes = {};
        for (const [key, value] of Object.entries(items)) {
          const oldValue = clone(store[key]);
          const newValue = clone(value);
          store[key] = newValue;
          changes[key] = { oldValue, newValue: clone(newValue) };
        }
        storageChangeListeners.forEach((listener) => listener(changes, areaName));
        callback?.();
        return Promise.resolve();
      },
    });

    window.chrome = {
      runtime: { id: 'ytqf-time-badges-test', onMessage: { addListener: () => {} } },
      storage: {
        sync: createStorageArea(syncStore, 'sync'),
        local: createStorageArea(localStore, 'local'),
        onChanged: {
          addListener: (listener) => storageChangeListeners.push(listener),
          removeListener: (listener) => {
            const index = storageChangeListeners.indexOf(listener);
            if (index >= 0) storageChangeListeners.splice(index, 1);
          },
        },
      },
    };
  });

  await page.addStyleTag({ content: assets.css });
  await page.addScriptTag({ content: assets.js });
  await page.locator(buttonSelector).waitFor({ timeout: 15_000 });

  const timeBadgesButton = page.locator(buttonSelector);
  await timeBadgesButton.click();
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => ({
    buttonActive: !!document.querySelector('#ytqf-bar .ytqf-days-button.active'),
    tagsOnBoard: document.querySelectorAll('.days-in-status').length,
  }));

  return {
    hiddenByDefault,
    ...state,
    passed: hiddenByDefault && state.buttonActive && state.tagsOnBoard > 0,
  };
}

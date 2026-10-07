/**
 * Verify that quick filters stay on their own agile boards after A → B → A → B.
 *
 * Run with browser_run_code_unsafe after the normal extension injection.
 * The storage mock uses sessionStorage, so navigation reloads the injected
 * content script while preserving saved values in the same browser tab.
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

  const boards = [
    { id: '153-6143', label: 'QA board A' },
    { id: '153-668', label: 'QA board B' },
  ];
  const storageKey = '__ytqfBoardIsolationStore';
  await page.evaluate((key) => {
    sessionStorage.setItem(key, JSON.stringify({ sync: {}, local: {} }));
  }, storageKey);

  const openBoard = async (id) => {
    await page.goto(`https://youtrack.jetbrains.com/agiles/${id}/current`);
    await page.locator('[data-test="ring-query-assist-input"]').waitFor({ timeout: 15000 });
    if (!page.url().includes(`/agiles/${id}/`)) {
      throw new Error(`Board ${id} redirected to ${page.url()}`);
    }

    await page.evaluate((key) => {
      const read = () => JSON.parse(sessionStorage.getItem(key));
      const storageArea = (area) => ({
        get: (keys, callback) => {
          const names = Array.isArray(keys)
            ? keys
            : typeof keys === 'string'
              ? [keys]
              : Object.keys(keys || {});
          const saved = read()[area];
          const values = Object.fromEntries(
            names.map((name) => [name, structuredClone(saved[name])]),
          );
          callback?.(values);
          return Promise.resolve(values);
        },
        set: (items, callback) => {
          const saved = read();
          Object.assign(saved[area], structuredClone(items));
          sessionStorage.setItem(key, JSON.stringify(saved));
          callback?.();
          return Promise.resolve();
        },
      });
      window.chrome = {
        runtime: { id: 'ytqf-board-isolation-test', onMessage: { addListener: () => {} } },
        storage: { sync: storageArea('sync'), local: storageArea('local') },
      };
    }, storageKey);

    await page.addStyleTag({ content: assets.css });
    await page.addScriptTag({ content: assets.js });
    await page.locator('#ytqf-bar .ytqf-filter .lbl', { hasText: 'My Tasks' }).waitFor();
  };

  const labels = () => page.locator('#ytqf-bar .ytqf-filter .lbl').allTextContents();
  const addFilter = async (label) => {
    await page.locator('#ytqf-bar button.btn', { hasText: 'Add filter...' }).click();
    await page.locator('#ytqf-name').fill(label);
    await page.locator('#ytqf-query').fill('#Unresolved');
    await page.locator('#ytqf-save').click();
    await page.locator('#ytqf-bar .ytqf-filter .lbl', { hasText: label }).waitFor();
  };

  await openBoard(boards[0].id);
  await addFilter(boards[0].label);
  const firstA = await labels();

  await openBoard(boards[1].id);
  const firstB = await labels();
  await addFilter(boards[1].label);
  const savedB = await labels();

  await openBoard(boards[0].id);
  await page.locator('#ytqf-bar .ytqf-filter .lbl', { hasText: boards[0].label }).waitFor();
  const returnA = await labels();

  await openBoard(boards[1].id);
  await page.locator('#ytqf-bar .ytqf-filter .lbl', { hasText: boards[1].label }).waitFor();
  const returnB = await labels();

  const keyA = `ytQuickFilters_${boards[0].id}`;
  const keyB = `ytQuickFilters_${boards[1].id}`;
  const store = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), storageKey);
  const storedA = store.sync[keyA]?.map((filter) => filter.label);
  const storedB = store.sync[keyB]?.map((filter) => filter.label);
  const onlyA = (items) => items.includes(boards[0].label) && !items.includes(boards[1].label);
  const onlyB = (items) => items.includes(boards[1].label) && !items.includes(boards[0].label);

  return {
    boards,
    firstA,
    firstB,
    savedB,
    returnA,
    returnB,
    storedA,
    storedB,
    passed:
      onlyA(firstA) &&
      !firstB.includes(boards[0].label) &&
      onlyB(savedB) &&
      onlyA(returnA) &&
      onlyB(returnB) &&
      onlyA(storedA || []) &&
      onlyB(storedB || []),
  };
}

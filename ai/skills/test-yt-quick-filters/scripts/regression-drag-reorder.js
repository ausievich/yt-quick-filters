/**
 * Drag a filter before another one and verify the new order is saved.
 *
 * Run after injecting the extension on the public agile board with
 * browser_run_code_unsafe and this file's absolute path as `filename`.
 */
async (page) => {
  const labels = ['QA drag alpha', 'QA drag beta'];
  const filterButtons = page.locator('#ytqf-bar .ytqf-filter');

  const addFilter = async (label) => {
    await page.locator('#ytqf-bar button.btn', { hasText: 'Add filter...' }).click();
    await page.locator('#ytqf-name').fill(label);
    await page.locator('#ytqf-query').fill('#Unresolved');
    await page.locator('#ytqf-save').click();
    await page.locator('#ytqf-bar .ytqf-filter', { hasText: label }).waitFor();
  };

  for (const label of labels) {
    if ((await filterButtons.filter({ hasText: label }).count()) === 0) {
      await addFilter(label);
    }
  }

  const readOrder = () =>
    filterButtons.locator('.lbl').allTextContents().then((texts) => texts.map((text) => text.trim()));

  const before = await readOrder();
  const [earlierLabel, laterLabel] = labels.sort(
    (a, b) => before.indexOf(a) - before.indexOf(b),
  );
  const from = before.indexOf(laterLabel);
  const to = before.indexOf(earlierLabel);
  const expected = [...before];
  expected.splice(to, 0, ...expected.splice(from, 1));

  const source = filterButtons.filter({ hasText: laterLabel });
  const target = filterButtons.filter({ hasText: earlierLabel });
  const sourceRect = await source.boundingBox();
  const targetRect = await target.boundingBox();
  if (!sourceRect || !targetRect) {
    return { passed: false, reason: 'Drag buttons are not visible', before };
  }

  const queryBefore = await page.evaluate(() => ({
    urlQuery: new URLSearchParams(location.search).get('query'),
    inputText: document.querySelector('[data-test="ring-query-assist-input"]')?.textContent?.trim(),
  }));

  const startX = sourceRect.x + sourceRect.width / 2;
  const startY = sourceRect.y + sourceRect.height / 2;
  const endX = targetRect.x + 2;
  const endY = targetRect.y + targetRect.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY, { steps: 3 });
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.waitForTimeout(450);
  await page.mouse.move(endX + 1, endY, { steps: 2 });
  const duringDrag = await page.evaluate(() => ({
    dragging: document.querySelector('#ytqf-bar .ytqf-filter.dragging')?.textContent?.trim(),
    shifting: document.querySelectorAll('#ytqf-bar .ytqf-filter.shifting').length,
  }));
  await page.mouse.up();

  await page.waitForFunction(
    (order) =>
      JSON.stringify(
        [...document.querySelectorAll('#ytqf-bar .ytqf-filter .lbl')].map((el) =>
          el.textContent.trim(),
        ),
      ) === JSON.stringify(order),
    expected,
    { timeout: 5000 },
  ).catch(() => null);

  const after = await readOrder();
  const saved = await page.evaluate(async () => {
    const boardId = location.pathname.match(/\/agiles\/([^/]+)/)?.[1] || 'default';
    const key = `ytQuickFilters_${boardId}`;
    return new Promise((resolve) =>
      chrome.storage.sync.get(key, (data) => resolve(data[key]?.map((filter) => filter.label))),
    );
  });
  const queryAfter = await page.evaluate(() => ({
    urlQuery: new URLSearchParams(location.search).get('query'),
    inputText: document.querySelector('[data-test="ring-query-assist-input"]')?.textContent?.trim(),
  }));

  const orderChanged = JSON.stringify(after) === JSON.stringify(expected);
  const orderSaved = JSON.stringify(saved) === JSON.stringify(expected);
  const queryUnchanged = JSON.stringify(queryAfter) === JSON.stringify(queryBefore);

  return {
    before,
    after,
    saved,
    expected,
    queryBefore,
    queryAfter,
    duringDrag,
    orderChanged,
    orderSaved,
    queryUnchanged,
    passed: orderChanged && orderSaved && queryUnchanged,
  };
}

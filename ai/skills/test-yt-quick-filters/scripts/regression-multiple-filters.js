/**
 * Multiple filters — enabling the setting combines selected filters with AND.
 * Clicking one selected filter again removes only that filter from the query.
 */
async (page) => {
  const getQuery = () =>
    page.evaluate(() => {
      const input = document.querySelector('[data-test="ring-query-assist-input"]');
      const inputText = input
        ? (input.innerText || input.textContent || '').replace(/\u00a0/g, ' ').trim()
        : '';
      const urlQuery = new URLSearchParams(location.search).get('query')?.trim() || '';
      return urlQuery || inputText;
    });

  const addFilter = async (label, query) => {
    await page.locator('#ytqf-bar button.btn', { hasText: 'Add filter...' }).click();
    await page.locator('#ytqf-name').fill(label);
    await page.locator('#ytqf-query').fill(query);
    await page.locator('#ytqf-save').click();
    await page.locator('#ytqf-bar button.btn', { hasText: label }).waitFor();
  };

  const clearActiveFilters = async () => {
    while (await page.locator('#ytqf-bar button.btn.active').count()) {
      await page.locator('#ytqf-bar button.btn.active').first().click();
      await page.waitForTimeout(1200);
    }
  };

  await page.evaluate(() => chrome.storage.sync.set({ ytqf_allowMultipleFilters: true }));
  await page.waitForTimeout(300);
  await clearActiveFilters();

  const secondLabel = 'QA multiple filters';
  const secondQuery = 'state: {In progress}';
  if ((await page.locator('#ytqf-bar button.btn', { hasText: secondLabel }).count()) === 0) {
    await addFilter(secondLabel, secondQuery);
  }

  const firstFilter = page.locator('#ytqf-bar button.btn', { hasText: 'My Tasks' });
  const secondFilter = page.locator('#ytqf-bar button.btn', { hasText: secondLabel });

  await firstFilter.click();
  await page.waitForTimeout(1200);
  await secondFilter.click();
  await page.waitForTimeout(1200);

  const combinedQuery = await getQuery();
  const bothActive =
    (await firstFilter.evaluate((element) => element.classList.contains('active'))) &&
    (await secondFilter.evaluate((element) => element.classList.contains('active')));
  const filtersCombined =
    /assignee:\s*me/i.test(combinedQuery) &&
    /state:\s*\{in progress\}/i.test(combinedQuery) &&
    /\band\b/i.test(combinedQuery);

  await firstFilter.click();
  await page.waitForTimeout(1200);

  const afterRemovingFirst = await getQuery();
  const onlySecondRemains =
    !/assignee:\s*me/i.test(afterRemovingFirst) &&
    /state:\s*\{in progress\}/i.test(afterRemovingFirst) &&
    !(await firstFilter.evaluate((element) => element.classList.contains('active'))) &&
    (await secondFilter.evaluate((element) => element.classList.contains('active')));

  await page.evaluate(() => chrome.storage.sync.set({ ytqf_allowMultipleFilters: false }));
  await page.waitForTimeout(300);
  await secondFilter.click();
  await page.waitForTimeout(1200);

  return {
    combinedQuery,
    afterRemovingFirst,
    bothActive,
    filtersCombined,
    onlySecondRemains,
    passed: bothActive && filtersCombined && onlySecondRemains,
  };
}

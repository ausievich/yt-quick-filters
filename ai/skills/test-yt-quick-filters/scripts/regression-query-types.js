/**
 * Must-pass query types — each filter applies and closes the suggestor.
 *
 * Use: browser_run_code_unsafe { filename: "<workspace>/.../regression-query-types.js" }
 */
async (page) => {
  const clearActiveFilter = async () => {
    const hadActive = await page.evaluate(() => {
      const active = document.querySelector('#ytqf-bar button.btn.active');
      if (active) {
        active.click();
        return true;
      }
      return false;
    });
    if (hadActive) await page.waitForTimeout(1200);
  };

  const popupState = () =>
    page.evaluate(() => {
      const popup = document.querySelector('[data-test="ring-popup ring-query-assist-popup"]');
      if (!popup) return { found: false, open: false };
      return {
        found: true,
        open: popup.getAttribute('data-test-shown') === 'true',
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

  const ensureFilter = async (label, query) => {
    if ((await page.locator('#ytqf-bar button.btn', { hasText: label }).count()) === 0) {
      await addFilter(label, query);
    }
  };

  await clearActiveFilter();
  await ensureFilter('QA braces', 'state: {In progress}');
  await ensureFilter('QA compound', 'Assignee: me State: Open');
  await ensureFilter('QA unresolved', '#Unresolved');

  const cases = [
    { label: 'My Tasks', query: 'Assignee: me' },
    { label: 'QA braces', query: 'state: {In progress}' },
    { label: 'QA compound', query: 'Assignee: me State: Open' },
    { label: 'QA unresolved', query: '#Unresolved' },
  ];

  const results = [];

  for (const { label, query } of cases) {
    await clearActiveFilter();
    await page.locator('#ytqf-bar button.btn', { hasText: label }).click();
    await page.waitForTimeout(1200);

    const popup = await popupState();
    const url = page.url();
    const inputText = await page.evaluate(() => {
      const input = document.querySelector('[data-test="ring-query-assist-input"]');
      return input ? (input.innerText || input.textContent || '').replace(/\u00a0/g, ' ').trim() : '';
    });

    const queryApplied =
      url.includes('query=') ||
      inputText.toLowerCase().includes(query.toLowerCase().split(' ')[0]);

    results.push({
      label,
      popupClosed: popup.found && !popup.open,
      queryApplied,
      url,
      inputText,
    });
  }

  const passed = results.every((r) => r.popupClosed && r.queryApplied);

  return { results, passed };
}

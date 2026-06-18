/**
 * Default suggestor regression — run after inject on a loaded agile board.
 *
 * Use: browser_run_code_unsafe { filename: "<workspace>/.cursor/skills/test-yt-quick-filters/scripts/regression-suggestor.js" }
 * (absolute path, forward slashes)
 */
async (page) => {
  const popupState = () =>
    page.evaluate(() => {
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

  const popup = await popupState();

  return {
    hasFilterBar: (await page.locator('#ytqf-bar').count()) > 0,
    url: page.url(),
    popup,
    passed: popup.found && !popup.open,
  };
}

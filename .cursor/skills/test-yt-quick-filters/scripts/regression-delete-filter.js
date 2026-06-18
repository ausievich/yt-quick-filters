/**
 * Delete filter — create via modal, remove via context menu.
 *
 * Use: browser_run_code_unsafe { filename: "<workspace>/.../regression-delete-filter.js" }
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

  const addFilter = async (label, query) => {
    await page.locator('#ytqf-bar button.btn', { hasText: 'Add filter...' }).click();
    await page.waitForTimeout(300);
    await page.locator('#ytqf-name').fill(label);
    await page.locator('#ytqf-query').fill(query);
    await page.locator('#ytqf-save').click();
    await page.waitForTimeout(700);
  };

  await clearActiveFilter();

  const deleteLabel = 'QA delete me';
  if ((await page.locator('#ytqf-bar button.btn .lbl', { hasText: deleteLabel }).count()) === 0) {
    await addFilter(deleteLabel, '#Unresolved');
  }

  const filterBtn = page.locator('#ytqf-bar button.btn').filter({ hasText: deleteLabel });
  await filterBtn.click({ button: 'right' });
  await page.locator('#ytqf-menu').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#ytqf-menu .mi.danger', { hasText: 'Delete' }).click();
  await page.waitForTimeout(1000);

  const filterGone = (await page.locator('#ytqf-bar button.btn').filter({ hasText: deleteLabel }).count()) === 0;

  return { deleteLabel, filterGone, passed: filterGone };
}

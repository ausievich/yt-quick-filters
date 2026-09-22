/**
 * Days In Status — toggle on, button active, tags appear on cards.
 *
 * Use: browser_run_code_unsafe { filename: "<workspace>/.../regression-days-in-status.js" }
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

  await clearActiveFilter();

  const daysButton = page.locator('#ytqf-bar .ytqf-days-button');
  if (await daysButton.evaluate((el) => el.classList.contains('active'))) {
    await daysButton.click();
    await page.waitForTimeout(1000);
  }

  await daysButton.click();
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => ({
    buttonActive: !!document.querySelector('#ytqf-bar .ytqf-days-button.active'),
    tagsOnBoard: document.querySelectorAll('.days-in-status').length,
  }));

  return {
    ...state,
    passed: state.buttonActive && state.tagsOnBoard > 0,
  };
}

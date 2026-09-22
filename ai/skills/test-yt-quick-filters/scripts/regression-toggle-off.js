/**
 * Toggle off — second click on active filter clears the query.
 *
 * Use: browser_run_code_unsafe { filename: "<workspace>/.../regression-toggle-off.js" }
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

  const getQueryState = () =>
    page.evaluate(() => {
      const input = document.querySelector('[data-test="ring-query-assist-input"]');
      const inputText = input ? (input.innerText || input.textContent || '').replace(/\u00a0/g, ' ').trim() : '';
      const urlQuery = new URLSearchParams(location.search).get('query')?.trim() || '';
      return { inputText, urlQuery, hasQueryParam: location.search.includes('query=') };
    });

  await clearActiveFilter();
  const myTasks = page.locator('#ytqf-bar button.btn', { hasText: 'My Tasks' });

  await myTasks.click();
  await page.waitForTimeout(1500);

  const afterOn = await getQueryState();
  const onApplied = afterOn.hasQueryParam || /assignee:\s*me/i.test(afterOn.inputText) || /assignee:\s*me/i.test(afterOn.urlQuery);

  await myTasks.click();
  await page.waitForTimeout(1500);

  const afterOff = await getQueryState();
  const offCleared =
    !afterOff.hasQueryParam &&
    afterOff.urlQuery === '' &&
    (afterOff.inputText === '' || afterOff.inputText.length === 0);

  return {
    afterOn,
    afterOff,
    passed: onApplied && offCleared,
  };
}

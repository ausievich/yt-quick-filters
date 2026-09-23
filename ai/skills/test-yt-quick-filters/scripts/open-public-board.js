/**
 * Opens the public test board after dismissing its CookieHub notice.
 *
 * Use first in a clean Playwright context:
 * browser_run_code_unsafe { filename: "<workspace>/ai/skills/test-yt-quick-filters/scripts/open-public-board.js" }
 *
 * CookieHub checks this browser cookie client-side. Keep it as a session cookie
 * so a test run never depends on the expiry date of the captured consent.
 */
async (page) => {
  await page.context().addCookies([
    {
      name: 'cookiehub',
      value:
        'eyJhbnN3ZXJlZCI6dHJ1ZSwicmV2aXNpb24iOjMsImRudCI6ZmFsc2UsImFsbG93U2FsZSI6dHJ1ZSwiaW1wbGljaXQiOnRydWUsInJlZ2lvbiI6IkcwIiwidG9rZW4iOiJTZ0JEZU9NVS05S2RQVTVEd2NkenJBIiwidGltZXN0YW1wIjoiMjAyNi0wOS0yM1QxNjoxMDo0MS4xNzJaIiwiYWxsQWxsb3dlZCI6dHJ1ZSwiY2F0ZWdvcmllcyI6W10sInZlbmRvcnMiOltdLCJzZXJ2aWNlcyI6W10sInRva2VuX3ZlcnNpb24iOjIsInRva2VuX3Byb29mIjoiZGpFNk0yWXpNV016WW1RNlUyZEJSR1ZQVFlVdE9VdGtVRlUyVkVkalpISjZRUS5FV0E4X0hJTE9wS2N5aU02cjlNbjNiMHJNWkF3QmRVNTdBQTBWUEo1Y0c4IiwiY291bnRyeSI6IlJTIiwic2Vzc2lvbl9lbWl0dGVkX2F0IjoxNzkwMTc5ODI5OTA4LCJzdGF0ZSI6bnVsbCwiaW1wbGljaXQiOmZhbHNlfQ==',
      domain: '.youtrack.jetbrains.com',
      path: '/',
      sameSite: 'Lax',
    },
  ]);

  await page.goto('https://youtrack.jetbrains.com/agiles/153-6143/current');
  await page.locator('[data-test="ring-query-assist-input"]').waitFor({ timeout: 10_000 });

  return {
    cookieHubConsentPresent: (await page.context().cookies()).some(
      ({ name, domain }) => name === 'cookiehub' && domain === '.youtrack.jetbrains.com',
    ),
    cookieBannerPresent: (await page.getByRole('heading', { name: 'Cookie Settings' }).count()) > 0,
    url: page.url(),
  };
}

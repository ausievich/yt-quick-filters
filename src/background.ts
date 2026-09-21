// Static content_scripts handle full page loads. This worker handles SPA entry.
// Firefox exposes promise-based APIs under browser; Chrome uses chrome.
const firefoxAPI = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser;
const extensionAPI = firefoxAPI ?? chrome;

const pendingInjections = new Map<string, Promise<void>>();

async function injectIntoDocument(tabId: number, documentId?: string): Promise<void> {
  // Firefox 128 uses frame targeting. Chrome can pin the exact document.
  const target = !firefoxAPI && documentId
    ? { tabId, documentIds: [documentId] }
    : { tabId, frameIds: [0] };
  const results = await extensionAPI.scripting.executeScript({
    target,
    func: () => location.protocol === 'https:' &&
      /\/agiles(?:\/|$)/.test(location.pathname) && !window.__ytqfStarted
  });

  if (!results[0]?.result) return;

  await extensionAPI.scripting.insertCSS({ target, files: ['dist/content.css'] });
  await extensionAPI.scripting.executeScript({ target, files: ['dist/content.js'] });
}

extensionAPI.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;

  const url = new URL(details.url);
  if (url.protocol !== 'https:' || !/\/agiles(?:\/|$)/.test(url.pathname)) return;

  const key = `${details.tabId}:${details.documentId ?? 'main'}`;
  if (pendingInjections.has(key)) return;

  const injection = injectIntoDocument(details.tabId, details.documentId)
    .catch((error) => {
      // The document may have closed, or site access may have been denied.
      console.warn('Could not load YouTrack Quick Filters after navigation:', error);
    })
    .finally(() => pendingInjections.delete(key));

  pendingInjections.set(key, injection);
}, { url: [{ schemes: ['https'], pathContains: '/agiles' }] });

export {};

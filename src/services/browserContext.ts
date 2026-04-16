/**
 * Resolve the YouTrack page URL for the AI side panel: prefer the active browser tab when it looks like YouTrack.
 */

export function isLikelyYouTrackPageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith('http')) return false;
    const h = u.hostname.toLowerCase();
    const path = u.pathname;
    return (
      h.includes('youtrack') ||
      /\.youtrack\.cloud$/i.test(h) ||
      path.includes('/youtrack/') ||
      path.includes('/agiles/') ||
      path.includes('/issue/')
    );
  } catch {
    return false;
  }
}

/**
 * Prefer the active tab URL when it is a YouTrack page; otherwise use the value synced from the content script (e.g. board).
 */
export async function resolveYouTrackPageUrlForAssistant(sessionFallback: string | null): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (url && isLikelyYouTrackPageUrl(url)) {
      return url;
    }
  } catch {
    /* ignore */
  }
  const f = sessionFallback?.trim();
  return f || null;
}

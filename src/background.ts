/**
 * Service worker.
 *
 * Боковая панель открывается кликом по иконке расширения (user gesture) —
 * chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).
 * Кнопка AI на доске только пишет контекст в chrome.storage.session (без open).
 */

const SIDEPANEL_PATH = 'public/sidepanel.html';

function configureGlobalSidePanel(): void {
  if (!chrome.sidePanel?.setOptions) return;
  void chrome.sidePanel
    .setOptions({
      path: SIDEPANEL_PATH,
      enabled: true
    })
    .catch((e) => console.warn('[ytqf] sidePanel.setOptions (global)', e));
}

if (chrome.sidePanel) {
  configureGlobalSidePanel();
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    /* ignore */
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  if (!chrome.sidePanel) return;
  try {
    await chrome.sidePanel.setOptions({
      path: SIDEPANEL_PATH,
      enabled: true
    });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) {
    console.error('[ytqf] onInstalled sidePanel', e);
  }
});

type SyncAiContextMessage = {
  type?: string;
  ytqf_youtrack_origin?: string;
  ytqf_sidepanel_issue?: string | null;
  /** Full URL of the YouTrack page when the user syncs from the board (supplement to active-tab detection). */
  ytqf_sidepanel_page_url?: string | null;
};

chrome.runtime.onMessage.addListener((message: SyncAiContextMessage) => {
  if (message?.type !== 'YTQF_SYNC_AI_CONTEXT') {
    return;
  }

  void (async () => {
    try {
      await chrome.storage.session.set({
        ytqf_youtrack_origin: message.ytqf_youtrack_origin ?? '',
        ytqf_sidepanel_issue: message.ytqf_sidepanel_issue ?? null,
        ytqf_sidepanel_page_url: message.ytqf_sidepanel_page_url ?? null
      });
    } catch (e) {
      console.error('[ytqf] sync AI context failed', e);
    }
  })();
});

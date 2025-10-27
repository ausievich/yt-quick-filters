/**
 * Background Service Worker for YouTrack Quick Filters
 * Handles secure token storage and API requests
 */

interface BackgroundMessage {
  type: 'TOKEN_UPDATED';
  token?: string;
  origin?: string;
  basePath?: string;
  expires?: number;
}

// Message handler
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'TOKEN_UPDATED':
      // Handle token updates from localStorage
      console.log('🔑 Token updated from localStorage for', message.origin);
      sendResponse({ success: true });
      return true;
  }

});


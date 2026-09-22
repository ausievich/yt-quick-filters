import React from 'react';
import { createRoot } from 'react-dom/client';
import { QuickFiltersApp } from './components/QuickFiltersApp';
import { TokenManager } from './services/tokenManager';
import { DaysInStatusSettingsService } from './services/daysInStatusSettings';
import './styles.css';

let isSettingsMessageBridgeInitialized = false;

const initializeSettingsMessageBridge = (): void => {
  if (isSettingsMessageBridgeInitialized) {
    return;
  }

  chrome.runtime.onMessage.addListener((message: any) => {
    if (message?.type !== 'UPDATE_DAYS_IN_STATUS_SETTINGS') {
      return;
    }

    const settingsService = DaysInStatusSettingsService.getInstance();
    settingsService.update({
      hideCreated: message.hideCreated,
      thresholdYellow: message.thresholdYellow,
      thresholdRed: message.thresholdRed,
      compactFormat: message.compactFormat,
      createdTagColored: message.createdTagColored,
    });
  });

  isSettingsMessageBridgeInitialized = true;
};

class ContentScript {
  private observer: MutationObserver | null = null;
  private root: any = null;

  private inject(): void {
    // Check if already injected
    if (document.getElementById('ytqf-app')) return;

    // Create a hidden container for the React app
    const appContainer = document.createElement('div');
    appContainer.id = 'ytqf-app';
    appContainer.style.display = 'none'; // Hidden container, portal will handle rendering
    document.body.appendChild(appContainer);

    // Mount React app
    this.root = createRoot(appContainer);
    this.root.render(<QuickFiltersApp />);
  }

  public async start(): Promise<void> {
    initializeSettingsMessageBridge();

    // Prime settings cache once per content script context.
    try {
      await DaysInStatusSettingsService.getInstance().init();
    } catch (error) {
      console.warn('Failed to initialize Days In Status settings cache:', error);
    }

    // Initialize token manager
    try {
      const tokenManager = TokenManager.getInstance();
      await tokenManager.initialize();
    } catch (error) {
      console.warn('⚠️ Failed to initialize token manager:', error);
    }

    // Initial injection
    this.inject();

    // Watch for DOM changes (for SPA navigation)
    this.observer = new MutationObserver(() => {
      this.inject();
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

// The flag lives in the extension's isolated world and survives bundle reinjection.
declare global {
  interface Window {
    __ytqfStarted?: boolean;
  }
}

// Initialize at most once per document, including while async startup is pending.
const initializeContentScript = async () => {
  if (window.__ytqfStarted) return;

  // Recheck at execution time: frame-targeted navigation may have moved on.
  // The background listener will start us later if this is not an Agile view.
  if (location.protocol !== 'https:' || !/\/agiles(?:\/|$)/.test(location.pathname)) return;

  if (chrome.runtime?.id) {
    window.__ytqfStarted = true;
    const contentScript = new ContentScript();
    await contentScript.start();
  } else {
    // Retry after a short delay
    setTimeout(initializeContentScript, 100);
  }
};

// Start initialization
initializeContentScript();

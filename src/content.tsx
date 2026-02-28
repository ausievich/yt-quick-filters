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
      createdTagColored: message.createdTagColored
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
      subtree: true
    });
  }
}

// Initialize content script with delay to ensure service worker is ready
const initializeContentScript = async () => {
  // Check if extension is ready
  if (chrome.runtime?.id) {
    const contentScript = new ContentScript();
    await contentScript.start();
  } else {
    // Retry after a short delay
    setTimeout(initializeContentScript, 100);
  }
};

// Start initialization
initializeContentScript();

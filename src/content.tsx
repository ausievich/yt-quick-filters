import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QuickFiltersApp } from './components/QuickFiltersApp';
import { TokenManager } from './services/tokenManager';
import { DaysInStatusSettingsService } from './services/daysInStatusSettings';
import { DaysInStatusSettings } from './types';
import './styles.css';

type SettingsMessage = { type?: string } & Partial<DaysInStatusSettings>;

let isSettingsMessageBridgeInitialized = false;

const initializeSettingsMessageBridge = (): void => {
  if (isSettingsMessageBridgeInitialized) {
    return;
  }

  chrome.runtime.onMessage.addListener((message: SettingsMessage | undefined) => {
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
  private root: Root | null = null;

  private inject(): void {
    // Check if already injected
    if (document.getElementById('ytqf-app')) return;

    // Keep the React root outside the page body. YouTrack replaces parts of its
    // application tree while filtering; a body child can be removed as part of
    // that update, which would cause a fresh mount and lose component state.
    const appContainer = document.createElement('div');
    appContainer.id = 'ytqf-app';
    appContainer.style.display = 'none'; // Hidden container, portal will handle rendering
    document.documentElement.appendChild(appContainer);

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

    // The app itself observes the board target and reattaches its portal after
    // SPA updates. Re-injecting the React root on every DOM mutation resets its
    // state while a filter is being applied.
    this.inject();
  }
}

// This flag is kept in the extension's isolated world, so it also guards
// against the bundle being injected more than once into the same document.
declare global {
  interface Window {
    __ytqfStarted?: boolean;
  }
}

const isAgileRoute = (): boolean => /\/agiles(?:\/|$)/.test(location.pathname);

const initializeContentScript = async () => {
  if (window.__ytqfStarted || !isAgileRoute()) {
    return;
  }

  if (chrome.runtime?.id) {
    window.__ytqfStarted = true;
    const contentScript = new ContentScript();
    await contentScript.start();
  } else {
    setTimeout(() => void initializeContentScript(), 100);
  }
};

void initializeContentScript();

const routeObserver = new MutationObserver(() => {
  void initializeContentScript();

  if (window.__ytqfStarted) {
    routeObserver.disconnect();
  }
});

routeObserver.observe(document.documentElement, { childList: true, subtree: true });

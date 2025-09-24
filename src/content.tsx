import React from 'react';
import { createRoot } from 'react-dom/client';
import { QuickFiltersApp } from './components/QuickFiltersApp';
import { UtilsService } from './services/utils';
import './styles.css';

class ContentScript {
  private utilsService: UtilsService;
  private observer: MutationObserver | null = null;

  constructor() {
    this.utilsService = UtilsService.getInstance();
  }

  private findToolbar(): Element | null {
    return this.utilsService.findToolbar();
  }

  private inject(): void {
    // Check if already injected
    if (document.getElementById('ytqf-bar')) return;

    const toolbar = this.findToolbar();
    if (!toolbar) return;

    // Create the filter bar container
    const filterBar = this.utilsService.createElement('div', '', 'ytqf-bar');
    toolbar.insertBefore(filterBar, toolbar.firstChild);

    // Mount React app directly into the filter bar
    const root = createRoot(filterBar);
    root.render(<QuickFiltersApp />);
  }

  public start(): void {
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

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Initialize content script
const contentScript = new ContentScript();
contentScript.start();

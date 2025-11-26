import React from 'react';
import { createRoot } from 'react-dom/client';
import { DaysInStatus } from '../components/DaysInStatus';
import { SimpleDaysInStatusService } from './simpleDaysInStatus';

export class DaysInStatusManager {
  private static instance: DaysInStatusManager;
  private observer: MutationObserver | null = null;
  private mountedComponents: Map<string, { root: any; element: HTMLElement }> = new Map();
  private isEnabled: boolean = true;

  public static getInstance(): DaysInStatusManager {
    if (!DaysInStatusManager.instance) {
      DaysInStatusManager.instance = new DaysInStatusManager();
    }
    return DaysInStatusManager.instance;
  }

  public async start(): Promise<void> {
    // Initialize the service
    const service = SimpleDaysInStatusService.getInstance();
    await service.initialize();
    
    // Initial scan
    this.scanAndAddDaysInStatus();
    
    // Watch for DOM changes
    this.observer = new MutationObserver(() => {
      this.scanAndAddDaysInStatus();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Clean up mounted components
    this.mountedComponents.forEach(({ root }) => {
      root.unmount();
    });
    this.mountedComponents.clear();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (enabled) {
      // Re-scan and add components
      this.scanAndAddDaysInStatus();
    } else {
      // Hide all components
      this.hideAllComponents();
    }
  }

  private hideAllComponents(): void {
    this.mountedComponents.forEach(({ root }) => {
      root.unmount();
    });
    this.mountedComponents.clear();
  }

  private scanAndAddDaysInStatus(): void {
    if (!this.isEnabled) {
      return;
    }
    
    const cards = this.findIssueCards();
    
    cards.forEach(card => {
      const issueId = this.extractIssueIdFromElement(card);
      if (issueId && !this.mountedComponents.has(issueId)) {
        this.addDaysInStatusToCard(card, issueId);
      }
    });

    // Remove components for cards that are no longer in the DOM
    this.mountedComponents.forEach((component, issueId) => {
      if (!document.body.contains(component.element)) {
        component.root.unmount();
        this.mountedComponents.delete(issueId);
      }
    });
  }

  private findIssueCards(): HTMLElement[] {
    const selectors = [
      '.yt-agile-card',
      '.agile-card',
      '[data-issue-id]',
      '.yt-issue-card',
      '.issue-card'
    ];
    
    const cards: HTMLElement[] = [];
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element instanceof HTMLElement && !cards.includes(element)) {
          cards.push(element);
        }
      });
    });
    
    return cards;
  }

  private extractIssueIdFromElement(element: HTMLElement): string | null {
    // Try data-issue-id attribute first
    const dataIssueId = element.getAttribute('data-issue-id');
    if (dataIssueId) {
      return dataIssueId;
    }

    // Try to find issue ID in child elements
    const issueIdSelectors = [
      '.yt-agile-card__id',
      '.agile-card__id',
      '.yt-issue-id',
      '.issue-id',
      '[data-test="issue-id"]'
    ];

    for (const selector of issueIdSelectors) {
      const idElement = element.querySelector(selector);
      if (idElement?.textContent) {
        const match = idElement.textContent.match(/([A-Z]+-\d+)/);
        if (match) {
          return match[1];
        }
      }
    }

    // Try to extract from href attributes
    const links = element.querySelectorAll('a[href*="/issue/"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href) {
        const match = href.match(/\/issue\/([A-Z]+-\d+)/);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
  }

  private addDaysInStatusToCard(cardElement: HTMLElement, issueId: string): void {
    // Check if already mounted
    if (this.mountedComponents.has(issueId)) {
      return;
    }

    // Create container for the component
    const container = document.createElement('div');
    container.style.position = 'relative';
    cardElement.style.position = 'relative';
    cardElement.appendChild(container);

    // Mount React component
    const root = createRoot(container);
    root.render(
      React.createElement(DaysInStatus, {
        issueId: issueId
      })
    );

    // Store reference for cleanup
    this.mountedComponents.set(issueId, { root, element: container });
  }
}
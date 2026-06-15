/**
 * Service for finding appropriate toolbar element for mounting filters
 */
export class YouTrackVersionService {
  private static instance: YouTrackVersionService;

  public static getInstance(): YouTrackVersionService {
    if (!YouTrackVersionService.instance) {
      YouTrackVersionService.instance = new YouTrackVersionService();
    }
    return YouTrackVersionService.instance;
  }

  /**
   * Find toolbar element for mounting filters
   * First tries new YouTrack version, then falls back to old version
   */
  public getTargetElement(): Element | null {
    // Check for fallback test flag
    const forceFallback = localStorage.getItem('ytqf-force-fallback') === 'true';
    
    if (forceFallback) {
      return this.findOldVersionTarget();
    }

    // Try new YouTrack version first
    const newTarget = this.findNewVersionTarget();
    if (newTarget) {
      return newTarget;
    }

    // Fallback to old YouTrack version
    return this.findOldVersionTarget();
  }

  private findNewVersionTarget(): Element | null {
    const topBar = document.querySelector('div.yt-agile-board__top-bar');
    if (topBar) {
      const searchPanel = topBar.querySelector('search-query-panel');
      if (searchPanel) {
        let filterContainer = topBar.querySelector('#ytqf-filter-container');
        if (!filterContainer) {
          filterContainer = document.createElement('div');
          filterContainer.id = 'ytqf-filter-container';
          (filterContainer as HTMLElement).style.cssText = 'display: inline-flex; align-items: center; margin-left: 16px;';
          topBar.insertBefore(filterContainer, searchPanel);
        }
        return filterContainer;
      }
    }
    return null;
  }

  private findOldVersionTarget(): Element | null {
    const toolbar = this.findToolbar();
    if (toolbar) {
      // For fallback mode, create the filter container (like in working version)
      let filterContainer = toolbar.querySelector('#ytqf-filter-container');
      if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'ytqf-filter-container';
        (filterContainer as HTMLElement).style.cssText = 'display: inline-flex; align-items: center;'; // Add basic flex styles if needed, or rely on CSS
        
        // Find the ng-transclude element to insert before it
        const buttonToolbar = toolbar.querySelector('ng-transclude[rg-button-toolbar]');
        if (buttonToolbar && buttonToolbar.parentNode === toolbar) {
          toolbar.insertBefore(filterContainer, buttonToolbar);
        } else {
          toolbar.insertBefore(filterContainer, toolbar.firstChild);
        }
      }
      return filterContainer;
    }
    return null;
  }

  public findToolbar(): Element | null {
    return document.querySelector('.yt-agile-board__toolbar[data-test="yt-agile-board-toolbar"]') ||
           document.querySelector('.yt-agile-board__toolbar');
  }

  /**
   * Mount point for "Save filter" inside the board search input.
   */
  public getSearchSaveButtonTarget(): Element | null {
    const anchor = this.findQueryAssistAnchor();
    if (!anchor) {
      return null;
    }

    return this.ensureSearchSaveContainer(anchor);
  }

  private findQueryAssistAnchor(): Element | null {
    const queryAssist = document.querySelector('[data-test="queryAssist"]');
    if (queryAssist) {
      return queryAssist.querySelector('[data-test="ring-query-assist"]') ?? queryAssist;
    }

    const toolbar = this.findToolbar();
    if (!toolbar) {
      return null;
    }

    const toolbarQueryAssist = toolbar.querySelector('[data-test="queryAssist"], rg-query-assist');
    if (toolbarQueryAssist) {
      return toolbarQueryAssist.querySelector('[data-test="ring-query-assist"]') ?? toolbarQueryAssist;
    }

    return null;
  }

  private ensureSearchSaveContainer(anchor: Element): Element {
    let container = document.getElementById('ytqf-search-save-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'ytqf-search-save-container';
    }

    if (container.parentElement !== anchor) {
      anchor.appendChild(container);
    }

    return container;
  }

}

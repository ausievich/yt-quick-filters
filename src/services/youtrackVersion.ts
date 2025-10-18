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
   * Find toolbar element specifically for Days In Status button
   * Always looks for the padded toolbar element
   */
  public getDaysInStatusTargetElement(): Element | null {
    const toolbar = document.querySelector('.yt-agile-board__toolbar.yt-agile-board__toolbar-padded');
    if (toolbar) {
      // Create or find the days in status button container
      let buttonContainer = toolbar.querySelector('#ytqf-days-button-container');
      if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'ytqf-days-button-container';
        (buttonContainer as HTMLElement).style.cssText = 'display: inline-flex; align-items: center; margin-right: 8px;';
        
        // Insert at the beginning of the toolbar
        toolbar.insertBefore(buttonContainer, toolbar.firstChild);
      }
      return buttonContainer;
    }
    return null;
  }
}

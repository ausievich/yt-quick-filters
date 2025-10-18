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
      let filterBar = toolbar.querySelector('#ytqf-bar');
      if (!filterBar) {
        filterBar = document.createElement('div');
        filterBar.id = 'ytqf-bar';
        toolbar.insertBefore(filterBar, toolbar.firstChild);
      }
      return filterBar;
    }
    return null;
  }

  public findToolbar(): Element | null {
    return document.querySelector('.yt-agile-board__toolbar[data-test="yt-agile-board-toolbar"]') ||
           document.querySelector('.yt-agile-board__toolbar');
  }
}

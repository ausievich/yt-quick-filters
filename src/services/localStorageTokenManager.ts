/**
 * LocalStorage Token Manager
 * Handles automatic token extraction from localStorage and domain-based storage
 */

interface TokenData {
  accessToken: string;
  expires: number; // epoch timestamp
}

interface StoredTokenInfo {
  token: string;
  expMs: number; // expiration time in milliseconds
  basePath: string;
}

interface YouTrackConfig {
  contextPath: string;
}

export class LocalStorageTokenManager {
  private static instance: LocalStorageTokenManager;
  private tokenMap: Map<string, StoredTokenInfo> = new Map();
  private refreshTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private liveWatcherActive: boolean = false;
  private isInitialized: boolean = false;
  private static readonly STORAGE_KEY = 'youtrack_tokens';

  public static getInstance(): LocalStorageTokenManager {
    if (!LocalStorageTokenManager.instance) {
      LocalStorageTokenManager.instance = new LocalStorageTokenManager();
    }
    return LocalStorageTokenManager.instance;
  }

  /**
   * Initialize token manager and start live watching
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }
    
    // Load existing tokens from storage
    await this.loadTokensFromStorage();
    
    // Extract token for current domain
    await this.extractAndStoreTokenForCurrentDomain();
    
    // Start live watcher
    this.startLiveWatcher();
    
    // Set up refresh timers
    this.setupRefreshTimers();
    
    // Set up periodic cleanup of expired tokens
    this.setupPeriodicCleanup();
    
    this.isInitialized = true;
  }

  /**
   * Load tokens from chrome.storage
   */
  private async loadTokensFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(LocalStorageTokenManager.STORAGE_KEY);
      const storedTokens = result[LocalStorageTokenManager.STORAGE_KEY] as Record<string, StoredTokenInfo> | undefined;
      
      if (storedTokens) {
        const now = Date.now();
        for (const [origin, tokenInfo] of Object.entries(storedTokens)) {
          // Only load non-expired tokens
          if (tokenInfo.expMs > now) {
            this.tokenMap.set(origin, tokenInfo);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to load tokens from storage:', error);
    }
  }

  /**
   * Save tokens to chrome.storage
   */
  private async saveTokensToStorage(): Promise<void> {
    try {
      const tokensObject = Object.fromEntries(this.tokenMap);
      await chrome.storage.local.set({ [LocalStorageTokenManager.STORAGE_KEY]: tokensObject });
    } catch (error) {
      console.error('❌ Failed to save tokens to storage:', error);
    }
  }

  /**
   * Extract token and metadata from localStorage for current domain
   */
  private async extractAndStoreTokenForCurrentDomain(): Promise<boolean> {
    try {
      const origin = window.location.origin;
      
      const tokenData = this.extractTokenFromLocalStorage();
      
      if (!tokenData) {
        return false;
      }

      const basePath = this.extractBasePathFromLocalStorage();
      
      const tokenInfo: StoredTokenInfo = {
        token: tokenData.accessToken,
        expMs: tokenData.expires * 1000,
        basePath
      };

      this.tokenMap.set(origin, tokenInfo);
      this.setupRefreshTimer(origin, tokenInfo);
      
      // Save to chrome.storage
      await this.saveTokensToStorage();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to extract token:', error);
      return false;
    }
  }

  /**
   * Extract token data from localStorage
   */
  private extractTokenFromLocalStorage(): TokenData | null {
    try {
      const tokenCandidates: Array<{ key: string; data: TokenData }> = [];
      
      // Find all token keys (ends with -token)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith('-token')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const tokenData = JSON.parse(value);
              if (tokenData.accessToken && tokenData.expires) {
                tokenCandidates.push({ key, data: tokenData });
              }
            } catch (parseError) {
              console.warn('⚠️ Failed to parse token data for key:', key, parseError);
            }
          }
        }
      }
      
      if (tokenCandidates.length === 0) {
        return null;
      }
      
      if (tokenCandidates.length === 1) {
        return tokenCandidates[0].data;
      }
      
      // Multiple tokens found - choose the best one
      // Prefer non-zero tokens (avoid 0-0-0-0-0-token)
      const nonZeroTokens = tokenCandidates.filter(c => !c.key.startsWith('0-0-0-0-0'));
      if (nonZeroTokens.length > 0) {
        // Choose the most recent one (highest expires)
        const bestToken = nonZeroTokens.reduce((best, current) => 
          current.data.expires > best.data.expires ? current : best
        );
        return bestToken.data;
      }
      
      // Fallback to the most recent zero token
      const bestToken = tokenCandidates.reduce((best, current) => 
        current.data.expires > best.data.expires ? current : best
      );
      return bestToken.data;
      
    } catch (error) {
      console.error('❌ Error accessing localStorage:', error);
      return null;
    }
  }

  /**
   * Extract base path from YouTrack config
   */
  private extractBasePathFromLocalStorage(): string {
    try {
      const configStr = localStorage.getItem('com.jetbrains.youtrack.youtrackConfig');
      if (configStr) {
        const config: YouTrackConfig = JSON.parse(configStr);
        const contextPath = config.contextPath || '';
        return contextPath;
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse YouTrack config:', error);
    }
    
    // Fallback to checking location.pathname
    const pathname = window.location.pathname;
    if (pathname.startsWith('/youtrack')) {
      return '/youtrack';
    }
    return '';
  }

  /**
   * Get token for current domain
   */
  public getTokenForCurrentDomain(): string | null {
    const origin = window.location.origin;
    const tokenInfo = this.tokenMap.get(origin);
    
    if (!tokenInfo) {
      return null;
    }

    return tokenInfo.token;
  }

  /**
   * Get full API base URL for current domain
   */
  public getApiBaseUrlForCurrentDomain(): string {
    const origin = window.location.origin;
    const tokenInfo = this.tokenMap.get(origin);
    const basePath = tokenInfo?.basePath || '';
    return `${origin}${basePath}`;
  }

  /**
   * Force refresh token for current domain
   */
  public async forceRefreshTokenForCurrentDomain(): Promise<boolean> {
    const origin = window.location.origin;
    
    // First try to extract from localStorage
    const refreshed = await this.extractAndStoreTokenForCurrentDomain();
    if (refreshed) {
      return true;
    }
    
    // If extraction failed, try to reload from storage
    await this.loadTokensFromStorage();
    
    const tokenInfo = this.tokenMap.get(origin);
    if (tokenInfo) {
      const now = Date.now();
      if (tokenInfo.expMs > now) {
        return true;
      } else {
        this.tokenMap.delete(origin);
        await this.saveTokensToStorage();
      }
    }
    
    return false;
  }

  /**
   * Setup refresh timers for all stored tokens
   */
  private setupRefreshTimers(): void {
    this.tokenMap.forEach((tokenInfo, origin) => {
      this.setupRefreshTimer(origin, tokenInfo);
    });
  }

  /**
   * Setup refresh timer for a specific token
   */
  private setupRefreshTimer(origin: string, tokenInfo: StoredTokenInfo): void {
    // Clear existing timer
    const existingTimer = this.refreshTimeouts.get(origin);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate refresh time (60 seconds before expiration)
    const refreshTime = tokenInfo.expMs - Date.now() - 60000;
    
    if (refreshTime > 0) {
      const timer = setTimeout(async () => {
        await this.refreshTokenForOrigin(origin);
      }, refreshTime);
      
      this.refreshTimeouts.set(origin, timer);
    }
  }

  /**
   * Setup periodic cleanup of expired tokens
   */
  private setupPeriodicCleanup(): void {
    // Clean up expired tokens every 5 minutes
    setInterval(async () => {
      await this.cleanupExpiredTokens();
    }, 5 * 60 * 1000);
  }

  /**
   * Refresh token for specific origin
   */
  private async refreshTokenForOrigin(origin: string): Promise<boolean> {
    try {
      // For now, just re-extract from localStorage
      // In a real implementation, you might want to make a refresh API call
      const currentOrigin = window.location.origin;
      if (origin === currentOrigin) {
        return await this.extractAndStoreTokenForCurrentDomain();
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to refresh token for', origin, ':', error);
      return false;
    }
  }

  /**
   * Start live watcher for localStorage changes
   */
  private startLiveWatcher(): void {
    if (this.liveWatcherActive) {
      return;
    }

    this.liveWatcherActive = true;
    
    // Patch localStorage.setItem to detect token updates
    const originalSetItem = localStorage.setItem;
    const self = this;
    
    localStorage.setItem = function(key: string, value: string) {
      // Call original method
      originalSetItem.call(this, key, value);
      
      // Check if this is a token update
      if (key.endsWith('-token')) {
        self.handleTokenUpdate(key, value);
      }
    };
  }

  /**
   * Handle token update from localStorage
   */
  private async handleTokenUpdate(key: string, value: string): Promise<void> {
    try {
      const tokenData = JSON.parse(value);
      if (tokenData.accessToken && tokenData.expires) {
        const origin = window.location.origin;
        const basePath = this.extractBasePathFromLocalStorage();
        const expMs = tokenData.expires * 1000;
        
        const tokenInfo: StoredTokenInfo = {
          token: tokenData.accessToken,
          expMs,
          basePath
        };

        this.tokenMap.set(origin, tokenInfo);
        this.setupRefreshTimer(origin, tokenInfo);
        
        // Save to chrome.storage
        await this.saveTokensToStorage();
      }
    } catch (error) {
      console.error('❌ Failed to handle token update:', error);
    }
  }

  /**
   * Clean up expired tokens from storage
   */
  private async cleanupExpiredTokens(): Promise<void> {
    const now = Date.now();
    const expiredOrigins: string[] = [];
    
    this.tokenMap.forEach((tokenInfo, origin) => {
      if (now >= tokenInfo.expMs) {
        expiredOrigins.push(origin);
      }
    });
    
    expiredOrigins.forEach(origin => {
      this.tokenMap.delete(origin);
      const timer = this.refreshTimeouts.get(origin);
      if (timer) {
        clearTimeout(timer);
        this.refreshTimeouts.delete(origin);
      }
    });
    
    if (expiredOrigins.length > 0) {
      await this.saveTokensToStorage();
    }
  }

  /**
   * Check if we have a valid token for current domain
   */
  public hasValidTokenForCurrentDomain(): boolean {
    return this.getTokenForCurrentDomain() !== null;
  }

  /**
   * Check if token is expired or will expire soon
   */
  public isTokenExpiredOrExpiringSoon(bufferMs: number = 0): boolean {
    const origin = window.location.origin;
    const tokenInfo = this.tokenMap.get(origin);
    
    if (!tokenInfo) {
      return true; // No token = expired
    }
    
    const now = Date.now();
    return tokenInfo.expMs <= (now + bufferMs);
  }
}

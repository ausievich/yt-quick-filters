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
    
    console.log('🔑 LocalStorageTokenManager: Initializing...');
    
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
            console.log('🔑 Loaded token from storage for', origin, 'expires at', new Date(tokenInfo.expMs));
          } else {
            console.log('🔑 Token expired in storage for', origin);
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
      console.log('💾 Tokens saved to storage:', Object.keys(tokensObject));
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
      
      console.log('🔍 Getting token from localStorage for', origin);
      const tokenData = this.extractTokenFromLocalStorage();
      
      if (!tokenData) {
        console.log('❌ No token found in localStorage');
        return false;
      }

      const basePath = this.extractBasePathFromLocalStorage();
      
      const tokenInfo: StoredTokenInfo = {
        token: tokenData.accessToken,
        expMs: tokenData.expires * 1000,
        basePath
      };

      this.tokenMap.set(origin, tokenInfo);
      console.log('✅ Token stored for', origin, 'token:', tokenData.accessToken.substring(0, 20) + '...');
      
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
                console.log('🔑 Found token candidate:', key, 'expires:', new Date(tokenData.expires * 1000));
              }
            } catch (parseError) {
              console.warn('⚠️ Failed to parse token data for key:', key, parseError);
            }
          }
        }
      }
      
      if (tokenCandidates.length === 0) {
        console.log('🔍 No valid tokens found in localStorage');
        return null;
      }
      
      if (tokenCandidates.length === 1) {
        console.log('✅ Using single token:', tokenCandidates[0].key);
        return tokenCandidates[0].data;
      }
      
      // Multiple tokens found - choose the best one
      console.log('🔍 Found multiple tokens, choosing the best one...');
      
      // Prefer non-zero tokens (avoid 0-0-0-0-0-token)
      const nonZeroTokens = tokenCandidates.filter(c => !c.key.startsWith('0-0-0-0-0'));
      if (nonZeroTokens.length > 0) {
        // Choose the most recent one (highest expires)
        const bestToken = nonZeroTokens.reduce((best, current) => 
          current.data.expires > best.data.expires ? current : best
        );
        console.log('✅ Using non-zero token:', bestToken.key, 'expires:', new Date(bestToken.data.expires * 1000));
        return bestToken.data;
      }
      
      // Fallback to the most recent zero token
      const bestToken = tokenCandidates.reduce((best, current) => 
        current.data.expires > best.data.expires ? current : best
      );
      console.log('✅ Using most recent token:', bestToken.key, 'expires:', new Date(bestToken.data.expires * 1000));
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
        console.log('🔍 YouTrack config found:', config);
        const contextPath = config.contextPath || '';
        console.log('🔍 Context path from config:', contextPath);
        return contextPath;
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse YouTrack config:', error);
    }
    
    // Fallback to checking location.pathname
    const pathname = window.location.pathname;
    console.log('🔍 Current pathname:', pathname);
    if (pathname.startsWith('/youtrack')) {
      console.log('🔍 Using /youtrack as base path from pathname');
      return '/youtrack';
    }
    console.log('🔍 No base path found, using empty string');
    return '';
  }

  /**
   * Get token for current domain
   */
  public getTokenForCurrentDomain(): string | null {
    const origin = window.location.origin;
    const tokenInfo = this.tokenMap.get(origin);
    
    if (!tokenInfo) {
      console.log('❌ No token found for', origin);
      return null;
    }

    console.log('🔑 Using token for', origin, 'token:', tokenInfo.token.substring(0, 20) + '...');
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
    const refreshed = await this.extractAndStoreTokenForCurrentDomain();
    if (!refreshed) {
      this.tokenMap.delete(origin);
    }
    return refreshed;
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
        console.log('🔄 Refreshing token for', origin);
        await this.refreshTokenForOrigin(origin);
      }, refreshTime);
      
      this.refreshTimeouts.set(origin, timer);
      console.log('⏰ Token refresh scheduled for', origin, 'in', Math.round(refreshTime / 1000), 'seconds');
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
    
    console.log('🧹 Periodic cleanup scheduled every 5 minutes');
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
        console.log('🔍 Token update detected in localStorage');
        self.handleTokenUpdate(key, value);
      }
    };

    console.log('👀 Live watcher started for localStorage token updates');
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
        
        console.log('🔄 Token updated for', origin, 'expires at', new Date(expMs));
        
        // Save to chrome.storage
        await this.saveTokensToStorage();
        
        // Notify background script about token update
        this.notifyBackgroundScript(tokenInfo);
      }
    } catch (error) {
      console.error('❌ Failed to handle token update:', error);
    }
  }

  /**
   * Notify background script about token update
   */
  private notifyBackgroundScript(tokenInfo: StoredTokenInfo): void {
    try {
      chrome.runtime.sendMessage({
        type: 'TOKEN_UPDATED',
        token: tokenInfo.token,
        origin: window.location.origin,
        basePath: tokenInfo.basePath,
        expires: tokenInfo.expMs
      });
    } catch (error) {
      console.warn('⚠️ Failed to notify background script:', error);
    }
  }

  /**
   * Clean up expired tokens from storage
   */
  public async cleanupExpiredTokens(): Promise<void> {
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
      console.log('🧹 Cleaned up expired tokens for:', expiredOrigins);
    }
  }

  /**
   * Check if we have a valid token for current domain
   */
  public hasValidTokenForCurrentDomain(): boolean {
    return this.getTokenForCurrentDomain() !== null;
  }
}

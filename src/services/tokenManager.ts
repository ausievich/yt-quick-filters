/**
 * Token Manager
 * Handles automatic token extraction from localStorage and domain-based storage
 */

interface TokenData {
  accessToken: string;
  expires: number; // epoch timestamp in seconds (UTC)
}

interface StoredTokenInfo {
  token: string;
  expMs: number; // expiration time in milliseconds (UTC epoch timestamp)
  basePath: string;
}

interface YouTrackConfig {
  contextPath: string;
}

export class TokenManager {
  private static instance: TokenManager;
  private tokenMap: Map<string, StoredTokenInfo> = new Map();
  private isInitialized: boolean = false;
  private static readonly STORAGE_KEY = 'youtrack_tokens';

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Initialize token manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }
    
    // Load existing tokens from storage
    await this.loadTokensFromStorage();
    
    // Extract token for current domain
    await this.extractAndStoreTokenForCurrentDomain();
    
    this.isInitialized = true;
  }

  /**
   * Load tokens from extension storage (chrome.storage.local)
   */
  private async loadTokensFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(TokenManager.STORAGE_KEY);
      const storedTokens = result[TokenManager.STORAGE_KEY] as Record<string, StoredTokenInfo> | undefined;
      
      if (storedTokens) {
        const now = Date.now(); // UTC epoch timestamp in milliseconds
        for (const [origin, tokenInfo] of Object.entries(storedTokens)) {
          // Only load non-expired tokens (both timestamps are in UTC, so timezone doesn't matter)
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
   * Save tokens to extension storage (chrome.storage.local)
   */
  private async saveTokensToStorage(): Promise<void> {
    try {
      const tokensObject = Object.fromEntries(this.tokenMap);
      await chrome.storage.local.set({ [TokenManager.STORAGE_KEY]: tokensObject });
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
        expMs: tokenData.expires * 1000, // Convert seconds to milliseconds (both UTC)
        basePath
      };

      this.tokenMap.set(origin, tokenInfo);
      
      // Save to extension storage
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
   * Refresh token for current domain from localStorage
   */
  public async refreshTokenForCurrentDomain(): Promise<boolean> {
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
      const now = Date.now(); // UTC epoch timestamp in milliseconds
      if (tokenInfo.expMs > now) { // Both are UTC, timezone doesn't matter
        return true;
      } else {
        this.tokenMap.delete(origin);
        await this.saveTokensToStorage();
      }
    }
    
    return false;
  }

  /**
   * Check if we have a valid token
   * If token is expiring soon (within 5 minutes), automatically refresh it
   * Returns true if token is valid, false otherwise
   */
  public async hasValidToken(): Promise<boolean> {
    try {
      const origin = window.location.origin;
      
      // Get token from extension storage (chrome.storage.local)
      const storedTokenInfo = this.tokenMap.get(origin);
      if (!storedTokenInfo) {
        // No token in extension storage - try to extract from localStorage
        return await this.refreshTokenForCurrentDomain();
      }
      
      const now = Date.now(); // UTC epoch timestamp in milliseconds
      const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
      
      // If token is not expiring soon, it's valid
      if (storedTokenInfo.expMs > (now + bufferMs)) {
        return true;
      }
      
      // Token is expiring soon or expired - refresh it from localStorage
      return await this.refreshTokenForCurrentDomain();
    } catch (error) {
      console.error('❌ Error checking token:', error);
      return false;
    }
  }
}

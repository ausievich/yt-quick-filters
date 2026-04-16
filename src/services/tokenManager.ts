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

  /**
   * Вкладка YouTrack, с которой открыли Side Panel (chrome-extension не имеет localStorage YT).
   */
  private contextYouTrackOrigin: string | null = null;

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /** Для страниц расширения (side panel): использовать токен для этого origin из storage */
  public setYouTrackContextOrigin(origin: string | null): void {
    this.contextYouTrackOrigin = origin;
  }

  private isExtensionPage(): boolean {
    return typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:';
  }

  private getEffectiveOrigin(): string {
    return this.contextYouTrackOrigin ?? window.location.origin;
  }

  /**
   * Initialize token manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.loadTokensFromStorage();

    await this.hasValidToken();

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
        const now = Date.now();
        for (const [origin, tokenInfo] of Object.entries(storedTokens)) {
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
   * Refresh token for current domain from localStorage
   */
  public async refreshTokenForCurrentDomain(): Promise<boolean> {
    try {
      const origin = this.getEffectiveOrigin();

      if (this.isExtensionPage()) {
        return this.tokenMap.has(origin);
      }

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

      const nonZeroTokens = tokenCandidates.filter((c) => !c.key.startsWith('0-0-0-0-0'));
      if (nonZeroTokens.length > 0) {
        const bestToken = nonZeroTokens.reduce((best, current) =>
          current.data.expires > best.data.expires ? current : best
        );
        return bestToken.data;
      }

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
        return config.contextPath || '';
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse YouTrack config:', error);
    }

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
    const origin = this.getEffectiveOrigin();
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
    const origin = this.getEffectiveOrigin();
    const tokenInfo = this.tokenMap.get(origin);
    const basePath = tokenInfo?.basePath || '';
    return `${origin}${basePath}`;
  }

  /**
   * Check if we have a valid token
   */
  public async hasValidToken(): Promise<boolean> {
    try {
      const origin = this.getEffectiveOrigin();
      const storedTokenInfo = this.tokenMap.get(origin);

      if (this.isExtensionPage() && this.contextYouTrackOrigin) {
        if (!storedTokenInfo) {
          return false;
        }
        const now = Date.now();
        const bufferMs = 5 * 60 * 1000;
        if (storedTokenInfo.expMs > now + bufferMs) {
          return true;
        }
        return storedTokenInfo.expMs > now;
      }

      if (!storedTokenInfo) {
        return await this.refreshTokenForCurrentDomain();
      }

      const now = Date.now();
      const bufferMs = 5 * 60 * 1000;

      if (storedTokenInfo.expMs > now + bufferMs) {
        return true;
      }

      return await this.refreshTokenForCurrentDomain();
    } catch (error) {
      console.error('❌ Error checking token:', error);
      return false;
    }
  }
}

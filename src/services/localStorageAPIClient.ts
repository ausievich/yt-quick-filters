/**
 * LocalStorage API Client for YouTrack
 * Uses tokens from localStorage with auto-retry on 401
 */

import { LocalStorageTokenManager } from './localStorageTokenManager';
import { IssueInfo } from '../types';

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class LocalStorageAPIClient {
  private static instance: LocalStorageAPIClient;
  private tokenManager: LocalStorageTokenManager;
  private isInitialized: boolean = false;

  public static getInstance(): LocalStorageAPIClient {
    if (!LocalStorageAPIClient.instance) {
      LocalStorageAPIClient.instance = new LocalStorageAPIClient();
    }
    return LocalStorageAPIClient.instance;
  }

  private constructor() {
    this.tokenManager = LocalStorageTokenManager.getInstance();
  }

  /**
   * Initialize the API client
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }
    
    await this.tokenManager.initialize();
    this.isInitialized = true;
  }

  /**
   * Make API request with auto-retry on 401
   */
  private async makeRequestWithRetry(url: string): Promise<APIResponse> {
    // Get token (should be valid from initialization)
    let token = this.tokenManager.getTokenForCurrentDomain();
    
    // If no token, try to refresh it
    if (!token) {
      const refreshed = await this.tokenManager.forceRefreshTokenForCurrentDomain();
      if (refreshed) {
        token = this.tokenManager.getTokenForCurrentDomain();
      }
    }
    
    if (!token) {
      return { success: false, error: 'No token found' };
    }

    const response = await this.makeRequest(url, token);
    
    // If successful, return
    if (response.success) {
      return response;
    }
    
    // If 401, refresh token and retry once
    if (response.error?.includes('401')) {
      const refreshed = await this.tokenManager.forceRefreshTokenForCurrentDomain();
      
      if (refreshed) {
        const newToken = this.tokenManager.getTokenForCurrentDomain();
        if (newToken) {
          return await this.makeRequest(url, newToken);
        }
      }
      
      return { success: false, error: 'No token found after refresh' };
    }
    
    return response;
  }

  /**
   * Make a single API request
   */
  private async makeRequest(url: string, token: string): Promise<APIResponse> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      };
            
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        return { 
          success: false, 
          error: `API request failed: ${response.status} ${response.statusText}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Fetch issue data
   */
  public async fetchIssue(issueId: string): Promise<IssueInfo | null> {
    try {
      const baseUrl = this.tokenManager.getApiBaseUrlForCurrentDomain();
      // Only request fields we actually use: id, created, updated
      const url = `${baseUrl}/api/issues/${issueId}?fields=id,created,updated`;
      
      const response = await this.makeRequestWithRetry(url);
      
      if (response.success && response.data) {
        const data = response.data;
        
        return {
          id: data.id,
          created: data.created || Date.now(),
          updated: data.updated || Date.now()
        };
      } else {
        console.warn('⚠️ Failed to fetch issue data:', response.error);
        return null;
      }
    } catch (error) {
      console.error('💥 API request error:', error);
      return null;
    }
  }

  /**
   * Check if we have a valid token
   */
  public hasValidToken(): boolean {
    return this.tokenManager.hasValidTokenForCurrentDomain();
  }

}

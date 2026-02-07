import { DaysInStatusInfo, IssueInfo } from '../types';
import { LocalStorageAPIClient } from './localStorageAPIClient';
import { LocalStorageTokenManager } from './localStorageTokenManager';

export class SimpleDaysInStatusService {
  private static instance: SimpleDaysInStatusService;
  private apiClient: LocalStorageAPIClient;
  private tokenManager: LocalStorageTokenManager;
  private isInitialized: boolean = false;

  public static getInstance(): SimpleDaysInStatusService {
    if (!SimpleDaysInStatusService.instance) {
      SimpleDaysInStatusService.instance = new SimpleDaysInStatusService();
    }
    return SimpleDaysInStatusService.instance;
  }

  private constructor() {
    this.apiClient = LocalStorageAPIClient.getInstance();
    this.tokenManager = LocalStorageTokenManager.getInstance();
  }

  /**
   * Initialize the service
   * Checks and refreshes token if needed (once when function is enabled)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    await this.apiClient.initialize();
    
    // Check if token is expired or expiring soon (with 5 second buffer)
    // If so, refresh it before making requests
    // This happens once when the function is enabled
    if (this.tokenManager.isTokenExpiredOrExpiringSoon(5000)) {
      await this.tokenManager.refreshTokenForCurrentDomain();
    }
    
    this.isInitialized = true;
  }

  /**
   * Calculate days in status using real data from YouTrack API
   */
  public async getDaysInStatusFromDOM(issueId: string, cardElement: HTMLElement): Promise<DaysInStatusInfo | null> {
    // Ensure service is initialized
    await this.initialize();
    
    // Try to get real data from localStorage API call
    try {
      const directData = await this.fetchIssueDirectly(issueId);
      if (directData) {
        return {
          issueId,
          created: directData.created,
          updated: directData.updated
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch issue data for', issueId, ':', error);
    }

    // Return null if API fails - will show dashes
    return null;
  }

  /**
   * Fetch issue data using localStorage API client
   */
  private async fetchIssueDirectly(issueId: string): Promise<IssueInfo | null> {
    try {
      const data = await this.apiClient.fetchIssue(issueId);
      return data;
    } catch (error) {
      return null;
    }
  }

}
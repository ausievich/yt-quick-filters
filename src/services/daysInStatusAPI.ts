import { DaysInStatusInfo, IssueInfo } from '../types';
import { LocalStorageAPIClient } from './localStorageAPIClient';

export class DaysInStatusAPI {
  private static instance: DaysInStatusAPI;
  private apiClient: LocalStorageAPIClient;
  private isInitialized: boolean = false;

  public static getInstance(): DaysInStatusAPI {
    if (!DaysInStatusAPI.instance) {
      DaysInStatusAPI.instance = new DaysInStatusAPI();
    }
    return DaysInStatusAPI.instance;
  }

  private constructor() {
    this.apiClient = LocalStorageAPIClient.getInstance();
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    await this.apiClient.initialize();
    
    this.isInitialized = true;
  }

  /**
   * Get days in status data from YouTrack API
   */
  public async getDaysInStatus(issueId: string): Promise<DaysInStatusInfo | null> {
    // Ensure service is initialized
    await this.initialize();

    try {
      const issueData = await this.apiClient.fetchIssue(issueId);
      if (issueData) {
        return {
          issueId,
          created: issueData.created,
          updated: issueData.updated
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch issue data for', issueId, ':', error);
    }

    // Return null if API fails - will show dashes
    return null;
  }

}
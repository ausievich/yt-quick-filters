/**
 * Secure API Client for YouTrack
 * Communicates with background script to make secure API requests
 */

import { IssueInfo } from '../types';

interface BackgroundResponse {
  success: boolean;
  data?: any;
  error?: string;
  token?: string;
}

export class SecureAPIClient {
  /**
   * Send message with retry logic for service worker
   */
  private static async sendMessageWithRetry(message: any, maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        return response;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  /**
   * Save token securely in background script
   */
  static async saveToken(token: string): Promise<boolean> {
    try {
      const response = await SecureAPIClient.sendMessageWithRetry({
        type: 'SAVE_TOKEN',
        token
      });
      return response?.success || false;
    } catch (error) {
      console.error('❌ Failed to save token:', error);
      return false;
    }
  }
  
  /**
   * Get token from background script
   */
  static async getToken(): Promise<string | null> {
    try {
      const response = await SecureAPIClient.sendMessageWithRetry({
        type: 'GET_TOKEN'
      });
      return response?.success ? response.token : null;
    } catch (error) {
      console.error('❌ Failed to get token:', error);
      return null;
    }
  }
  
  /**
   * Clear token from background script
   */
  static async clearToken(): Promise<boolean> {
    try {
      const response = await SecureAPIClient.sendMessageWithRetry({
        type: 'CLEAR_TOKEN'
      });
      return response?.success || false;
    } catch (error) {
      console.error('❌ Failed to clear token:', error);
      return false;
    }
  }
  
  /**
   * Fetch issue data securely through background script
   */
  static async fetchIssue(issueId: string): Promise<IssueInfo | null> {
    try {
      const baseUrl = window.location.origin;
      
      const response = await SecureAPIClient.sendMessageWithRetry({
        type: 'API_CALL',
        path: issueId,
        url: baseUrl
      });
      
      if (response?.success && response.data) {
        const data = response.data;
        return {
          id: data.id,
          idReadable: data.idReadable,
          summary: data.summary || '',
          created: data.created || Date.now(),
          updated: data.updated || Date.now(),
          resolved: data.resolved,
          state: data.state,
          project: data.project
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('💥 Secure API request error:', error);
      return null;
    }
  }
  
  /**
   * Check if we have a valid token
   */
  static async hasValidToken(): Promise<boolean> {
    const token = await SecureAPIClient.getToken();
    return token !== null && token.length > 10;
  }
}

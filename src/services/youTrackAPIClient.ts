/**
 * YouTrack API Client
 * Uses tokens from localStorage with auto-retry on 401
 */

import { TokenManager } from './tokenManager';
import { IssueInfo } from '../types';

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class YouTrackAPIClient {
  private static instance: YouTrackAPIClient;
  private tokenManager: TokenManager;
  private isInitialized: boolean = false;

  public static getInstance(): YouTrackAPIClient {
    if (!YouTrackAPIClient.instance) {
      YouTrackAPIClient.instance = new YouTrackAPIClient();
    }
    return YouTrackAPIClient.instance;
  }

  private constructor() {
    this.tokenManager = TokenManager.getInstance();
  }

  /**
   * Initialize the API client
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.tokenManager.initialize();
    this.isInitialized = true;
  }

  /**
   * Make API request with auto-retry on 401
   */
  private async makeRequestWithRetry(
    url: string,
    options?: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<APIResponse> {
    let token = this.tokenManager.getTokenForCurrentDomain();

    if (!token) {
      const refreshed = await this.tokenManager.refreshTokenForCurrentDomain();
      if (refreshed) {
        token = this.tokenManager.getTokenForCurrentDomain();
      }
    }

    if (!token) {
      return { success: false, error: 'No token found' };
    }

    const response = await this.makeRequest(url, token, options);

    if (response.success) {
      return response;
    }

    if (response.error?.includes('401')) {
      const refreshed = await this.tokenManager.refreshTokenForCurrentDomain();

      if (refreshed) {
        const newToken = this.tokenManager.getTokenForCurrentDomain();
        if (newToken) {
          return await this.makeRequest(url, newToken, options);
        }
      }

      return { success: false, error: 'No token found after refresh' };
    }

    return response;
  }

  /**
   * Make a single API request
   */
  private async makeRequest(
    url: string,
    token: string,
    options?: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<APIResponse> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {})
      };

      if (options?.body && (options.method === 'POST' || options.method === 'PATCH' || options.method === 'PUT')) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers,
        credentials: 'include',
        body: options?.body ? JSON.stringify(options.body) : undefined
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          return { success: true, data };
        }
        return { success: true, data: null };
      }
      const errorText = await response.text().catch(() => response.statusText);
      return {
        success: false,
        error: `API request failed: ${response.status} ${errorText}`
      };
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
      const url = `${baseUrl}/api/issues/${issueId}?fields=id,created,updated`;

      const response = await this.makeRequestWithRetry(url);

      if (response.success && response.data) {
        const data = response.data;

        return {
          id: data.id,
          created: data.created || Date.now(),
          updated: data.updated || Date.now()
        };
      }
      console.warn('⚠️ Failed to fetch issue data:', response.error);
      return null;
    } catch (error) {
      console.error('💥 API request error:', error);
      return null;
    }
  }

  /**
   * Get full issue details with all fields
   */
  public async getIssueDetails(issueId: string): Promise<any | null> {
    try {
      const baseUrl = this.tokenManager.getApiBaseUrlForCurrentDomain();
      const url = `${baseUrl}/api/issues/${issueId}`;

      const response = await this.makeRequestWithRetry(url);

      if (response.success && response.data) {
        return response.data;
      }
      console.warn('⚠️ Failed to fetch issue details:', response.error);
      return null;
    } catch (error) {
      console.error('💥 API request error:', error);
      return null;
    }
  }

  /**
   * Search issues (YouTrack query language)
   */
  public async searchIssues(query: string, top: number = 10): Promise<APIResponse> {
    const baseUrl = this.tokenManager.getApiBaseUrlForCurrentDomain();
    const safeTop = Math.min(50, Math.max(1, top));
    const url = `${baseUrl}/api/issues?fields=idReadable,summary,project(shortName)&query=${encodeURIComponent(
      query
    )}&$top=${safeTop}`;
    return this.makeRequestWithRetry(url);
  }

  /**
   * Execute a YouTrack command on an issue
   */
  public async executeCommand(issueId: string, command: string, comment?: string): Promise<APIResponse> {
    try {
      const baseUrl = this.tokenManager.getApiBaseUrlForCurrentDomain();
      const url = `${baseUrl}/api/issues/${issueId}/execute?fields=id,summary,state(name),priority(name)`;

      const body: Record<string, unknown> = { query: command };
      if (comment) {
        body.comment = comment;
      }

      return await this.makeRequestWithRetry(url, {
        method: 'POST',
        body
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a subtask
   */
  public async createSubtask(parentIssueId: string, summary: string, description?: string): Promise<APIResponse> {
    try {
      const baseUrl = this.tokenManager.getApiBaseUrlForCurrentDomain();

      const parentIssue = await this.getIssueDetails(parentIssueId);
      if (!parentIssue || !parentIssue.project) {
        return { success: false, error: 'Failed to get parent issue project' };
      }

      const projectId = parentIssue.project.id;
      const url = `${baseUrl}/api/issues?fields=id,summary`;

      const body: Record<string, unknown> = {
        project: { id: projectId },
        summary,
        type: { name: 'Subtask' }
      };

      if (description) {
        body.description = description;
      }

      const createResponse = await this.makeRequestWithRetry(url, {
        method: 'POST',
        body
      });

      if (!createResponse.success || !createResponse.data) {
        return createResponse;
      }

      const subtaskId = createResponse.data.id;
      const linkUrl = `${baseUrl}/api/issues/${subtaskId}/execute`;
      const linkResponse = await this.makeRequestWithRetry(linkUrl, {
        method: 'POST',
        body: {
          query: `Subtask of ${parentIssueId}`
        }
      });

      if (!linkResponse.success) {
        console.warn('⚠️ Created subtask but failed to link it:', linkResponse.error);
      }

      return createResponse;
    } catch (error) {
      return {
        success: false,
        error: `Failed to create subtask: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update issue fields directly
   */
  public async updateIssue(
    issueId: string,
    updates: {
      summary?: string;
      description?: string;
      state?: string;
      priority?: string;
      assignee?: string;
    }
  ): Promise<APIResponse> {
    try {
      const baseUrl = this.tokenManager.getApiBaseUrlForCurrentDomain();
      const url = `${baseUrl}/api/issues/${issueId}?fields=id,summary,state(name),priority(name)`;

      const body: Record<string, unknown> = {};

      if (updates.summary !== undefined) {
        body.summary = updates.summary;
      }
      if (updates.description !== undefined) {
        body.description = updates.description;
      }
      if (updates.state) {
        body.state = { name: updates.state };
      }
      if (updates.priority) {
        body.priority = { name: updates.priority };
      }
      if (updates.assignee) {
        body.assignee = { login: updates.assignee };
      }

      return await this.makeRequestWithRetry(url, {
        method: 'PATCH',
        body
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse issue ID from URL or text
   */
  public parseIssueId(input: string): string | null {
    const match = input.match(/([A-Z]+-\d+)/i);
    return match ? match[1] : null;
  }
}

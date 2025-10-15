/**
 * Background Service Worker for YouTrack Quick Filters
 * Handles secure token storage and API requests
 */

interface BackgroundMessage {
  type: 'SAVE_TOKEN' | 'API_CALL' | 'GET_TOKEN' | 'CLEAR_TOKEN';
  token?: string;
  path?: string;
  url?: string;
}

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Secure token storage
class TokenManager {
  private static readonly STORAGE_KEY = 'youtrack_token';
  
  static async saveToken(token: string): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: token });
    } catch (error) {
      console.error('❌ Failed to save token:', error);
    }
  }
  
  static async getToken(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || null;
    } catch (error) {
      console.error('❌ Failed to get token:', error);
      return null;
    }
  }
  
  static async clearToken(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
    } catch (error) {
      console.error('❌ Failed to clear token:', error);
    }
  }
}

// Secure API client
class SecureAPIClient {
  private static async makeRequest(url: string, token?: string): Promise<APIResponse> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          return { success: true, data };
        } else {
          return { success: false, error: 'Response is not JSON' };
        }
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
  
  static async fetchIssue(issueId: string, baseUrl: string, token?: string): Promise<APIResponse> {
    const url = `${baseUrl}/youtrack/api/issues/${issueId}?fields=id,idReadable,summary,created,updated,resolved,project`;
    return this.makeRequest(url, token);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'SAVE_TOKEN':
      if (message.token) {
        TokenManager.saveToken(message.token).then(() => {
          sendResponse({ success: true });
        });
        return true; // Keep message channel open for async response
      }
      break;
      
    case 'GET_TOKEN':
      TokenManager.getToken().then(token => {
        sendResponse({ success: true, token });
      });
      return true; // Keep message channel open for async response
      
    case 'CLEAR_TOKEN':
      TokenManager.clearToken().then(() => {
        sendResponse({ success: true });
      });
      return true; // Keep message channel open for async response
      
    case 'API_CALL':
      if (message.path && message.url) {
        const token = TokenManager.getToken();
        token.then(t => {
          if (!t) {
            sendResponse({ success: false, error: 'No token found. Please setup token first.' });
            return;
          }
          return SecureAPIClient.fetchIssue(message.path!, message.url!, t);
        }).then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
      }
      break;
  }
  
  sendResponse({ success: false, error: 'Unknown message type' });
});


import { DaysInStatusInfo, IssueInfo } from '../types';

export class SimpleDaysInStatusService {
  private static instance: SimpleDaysInStatusService;
  private interceptedToken: string | null = null;
  private originalFetch: typeof fetch | null = null;
  private hasLoggedLocalStorage: boolean = false;

  public static getInstance(): SimpleDaysInStatusService {
    if (!SimpleDaysInStatusService.instance) {
      SimpleDaysInStatusService.instance = new SimpleDaysInStatusService();
    }
    return SimpleDaysInStatusService.instance;
  }

  constructor() {
    this.startTokenInterception();
  }

  /**
   * Start intercepting fetch requests to capture auth tokens
   */
  private startTokenInterception(): void {
    if (this.originalFetch) return; // Already started
    
    this.originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
          // Check for Authorization header in the request
          if (init?.headers) {
            const headers = init.headers as Record<string, string>;
            if (headers.Authorization && headers.Authorization.startsWith('Bearer ')) {
              const token = headers.Authorization.substring(7);
              if (token.length > 10) {
                self.interceptedToken = token;
              }
            }
          }
      
      // Call original fetch
      return self.originalFetch!.call(window, input, init);
    };
  }

  /**
   * Calculate days in status using real data from YouTrack API
   */
  public async getDaysInStatusFromDOM(issueId: string, cardElement: HTMLElement): Promise<DaysInStatusInfo> {
    // Try to get real data from direct API call
    try {
      const directData = await this.fetchIssueDirectly(issueId);
      if (directData) {
        // Calculate days since creation (for now, until we get status history)
        const currentTime = Date.now();
        const daysInCurrentStatus = Math.floor((currentTime - directData.created) / (1000 * 60 * 60 * 24));
        
        return {
          issueId,
          daysInCurrentStatus,
          statusName: directData.state?.name || 'Unknown',
          lastStatusChange: directData.created,
          created: directData.created,
          updated: directData.updated
        };
      }
    } catch (error) {
      // Silent fail
    }

    // If API call fails, return null to indicate no data available
    throw new Error(`Unable to fetch data for ${issueId}`);
  }

  /**
   * Fetch issue data directly from YouTrack API
   */
  private async fetchIssueDirectly(issueId: string): Promise<IssueInfo | null> {
    try {
      // Use the correct endpoint format: /youtrack/api/issues/{issueId}
      const url = `${window.location.origin}/youtrack/api/issues/${issueId}?fields=id,idReadable,summary,created,updated,resolved,project`;
      
      // Try to get the Bearer token from the page
      const authToken = this.extractAuthToken();
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };
      
      // Add authorization header if we found a token
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (response.ok) {
        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
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
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract Bearer token from the page (from localStorage, cookies, or meta tags)
   */
  private extractAuthToken(): string | null {
    // First check if we have an intercepted token
    if (this.interceptedToken) {
      return this.interceptedToken;
    }
    
    // Try to find token in various places
    const sources = [
      // Check localStorage for permanent tokens
      () => localStorage.getItem('youtrack_permanent_token'),
      () => localStorage.getItem('youtrack_token'),
      () => localStorage.getItem('permanent_token'),
      () => localStorage.getItem('auth_token'),
      () => localStorage.getItem('token'),
      () => localStorage.getItem('access_token'),
      () => localStorage.getItem('bearer_token'),
      
      // Check sessionStorage
      () => sessionStorage.getItem('youtrack_permanent_token'),
      () => sessionStorage.getItem('youtrack_token'),
      () => sessionStorage.getItem('permanent_token'),
      () => sessionStorage.getItem('auth_token'),
      () => sessionStorage.getItem('token'),
      () => sessionStorage.getItem('access_token'),
      () => sessionStorage.getItem('bearer_token'),
      
      // Check meta tags
      () => document.querySelector('meta[name="youtrack-permanent-token"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="youtrack-token"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="auth-token"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
      
      // Check for token in window object
      () => (window as any).youtrackPermanentToken,
      () => (window as any).youtrackToken,
      () => (window as any).permanentToken,
      () => (window as any).authToken,
      () => (window as any).accessToken,
      () => (window as any).token,
      
      // Check cookies
      () => this.getCookie('youtrack_permanent_token'),
      () => this.getCookie('youtrack_token'),
      () => this.getCookie('permanent_token'),
      () => this.getCookie('auth_token'),
      () => this.getCookie('access_token'),
      () => this.getCookie('token'),
    ];
    
        for (const source of sources) {
          try {
            const token = source();
            if (token && token.length > 10) {
              // Check if it's a permanent token (starts with 'perm:')
              if (token.startsWith('perm:')) {
                return token;
              }
              // Check if it's a regular Bearer token
              if (token.includes('.') && token.length > 20) {
                return token;
              }
              // For other tokens, check if they look valid
              if (token.length > 20) {
                return token;
              }
            }
          } catch (error) {
            // Ignore errors from individual sources
          }
        }
        
        // Try to intercept existing fetch requests to get token
        const interceptedToken = this.interceptExistingRequests();
        if (interceptedToken) {
          return interceptedToken;
        }
        
        return null;
  }

  /**
   * Get cookie value by name
   */
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  /**
   * Try to intercept existing fetch requests to extract token
   */
  private interceptExistingRequests(): string | null {
    // This is a bit hacky, but we can try to find tokens in the current page
    // by looking at existing network requests or page content
    
    // Check if there are any script tags with tokens
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      const tokenMatch = content.match(/Bearer\s+([A-Za-z0-9\-._~+/]+=*)/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }
    
    // Check for tokens in data attributes
    const elements = document.querySelectorAll('[data-token], [data-auth-token], [data-bearer-token]');
    for (const element of elements) {
      const token = element.getAttribute('data-token') || 
                   element.getAttribute('data-auth-token') || 
                   element.getAttribute('data-bearer-token');
      if (token && token.length > 10) {
        return token;
      }
    }
    
    return null;
  }

  /**
   * Simple hash function for deterministic values
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract status name from card element
   */
  private extractStatusName(cardElement: HTMLElement): string | undefined {
    const statusElement = cardElement.querySelector('.yt-agile-card__column-title, .agile-card__column-title, .yt-issue-state, .issue-state');
    return statusElement?.textContent?.trim();
  }

  /**
   * Test API for a single issue (for debugging)
   */
  public async testApiForIssue(issueId: string): Promise<void> {
    console.log(`🧪 Testing API for issue: ${issueId}`);
    try {
      const data = await this.fetchIssueDirectly(issueId);
      if (data) {
        console.log(`✅ API test successful for ${issueId}:`, data);
      } else {
        console.log(`❌ API test failed for ${issueId}: No data returned`);
      }
    } catch (error) {
      console.log(`❌ API test error for ${issueId}:`, error);
    }
  }
}

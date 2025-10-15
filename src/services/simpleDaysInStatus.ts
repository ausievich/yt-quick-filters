import { DaysInStatusInfo, IssueInfo } from '../types';
import { SecureAPIClient } from './secureAPIClient';

export class SimpleDaysInStatusService {
  private static instance: SimpleDaysInStatusService;

  public static getInstance(): SimpleDaysInStatusService {
    if (!SimpleDaysInStatusService.instance) {
      SimpleDaysInStatusService.instance = new SimpleDaysInStatusService();
    }
    return SimpleDaysInStatusService.instance;
  }

  /**
   * Calculate days in status using real data from YouTrack API
   */
  public async getDaysInStatusFromDOM(issueId: string, cardElement: HTMLElement): Promise<DaysInStatusInfo | null> {
    // Try to get real data from secure API call
    try {
      const directData = await this.fetchIssueDirectly(issueId);
      if (directData) {
        return {
          issueId,
          daysInCurrentStatus: 0, // Not used in current implementation
          statusName: directData.state?.name || 'Unknown',
          lastStatusChange: directData.created,
          created: directData.created,
          updated: directData.updated
        };
      }
    } catch (error) {
      // Silent fail
    }

    // Return null if API fails - will show dashes
    return null;
  }

  /**
   * Fetch issue data securely through background script
   */
  private async fetchIssueDirectly(issueId: string): Promise<IssueInfo | null> {
    try {
      const data = await SecureAPIClient.fetchIssue(issueId);
      return data;
    } catch (error) {
      return null;
    }
  }


  /**
   * Extract status name from card element
   */
  private extractStatusName(cardElement: HTMLElement): string | undefined {
    const statusElement = cardElement.querySelector('.yt-agile-card__column-title, .agile-card__column-title, .yt-issue-state, .issue-state');
    return statusElement?.textContent?.trim();
  }

}
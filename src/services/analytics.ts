export type AnalyticsEventName =
  | 'filter_created'
  | 'filter_edited'
  | 'filter_duplicated'
  | 'filter_deleted'
  | 'filter_toggled'
  | 'filters_reordered'
  | 'combine_filters_changed'
  | 'days_in_status_changed'
  | 'theme_changed';

// Only these properties may ever leave the extension. Never add filter names or queries,
// YouTrack URLs or domains, projects, issues, users or tokens.
export interface AnalyticsProperties {
  action?: string;
  filter_count?: number;
  enabled?: boolean;
}

export const ANALYTICS_MESSAGE_TYPE = 'YTQF_ANALYTICS_EVENT';

export interface AnalyticsMessage {
  type: typeof ANALYTICS_MESSAGE_TYPE;
  event: AnalyticsEventName;
  properties: AnalyticsProperties;
}

// Content scripts and the popup hand events to the background worker, which owns the network call.
export const trackEvent = (
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void => {
  try {
    const message: AnalyticsMessage = { type: ANALYTICS_MESSAGE_TYPE, event, properties };
    void Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => undefined);
  } catch {
    // Analytics must never break the feature that triggered it.
  }
};

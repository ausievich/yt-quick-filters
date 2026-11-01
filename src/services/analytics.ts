export type AnalyticsEventName =
  | 'filter_created'
  | 'filter_edited'
  | 'filter_duplicated'
  | 'filter_deleted'
  | 'filter_toggled'
  | 'filters_reordered'
  | 'combine_filters_changed'
  | 'days_in_status_changed'
  | 'theme_changed'
  | 'settings_snapshot';

// Only these properties may ever leave the extension. Never add filter names or queries,
// YouTrack URLs or domains, projects, issues, users or tokens.
export interface AnalyticsProperties {
  action?: string;
  // filter_created, filter_duplicated, filter_deleted: filters on the current board afterwards.
  board_filter_count?: number;
  enabled?: boolean;
  // settings_snapshot only: current settings, no thresholds or user-entered text.
  combine_filters?: boolean;
  time_badges_button?: boolean;
  created_tag?: boolean;
  created_tag_colored?: boolean;
  theme?: string;
  total_filter_count?: number;
}

export const ALLOWED_PROPERTY_KEYS: readonly (keyof AnalyticsProperties)[] = [
  'action',
  'board_filter_count',
  'enabled',
  'combine_filters',
  'time_badges_button',
  'created_tag',
  'created_tag_colored',
  'theme',
  'total_filter_count',
];

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

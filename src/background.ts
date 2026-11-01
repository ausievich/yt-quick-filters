import {
  ALLOWED_PROPERTY_KEYS,
  ANALYTICS_MESSAGE_TYPE,
  AnalyticsMessage,
  AnalyticsProperties,
} from './services/analytics';
import { DEFAULT_ALLOW_MULTIPLE_FILTERS, DEFAULT_COLOR_THEME } from './services/storage';

// PostHog project API key (a public write-only key). Leave empty to disable sending.
const POSTHOG_API_KEY = 'phc_pgvSJmRAXvPDE4fkv4cbLuJFsjWd9BW3tso8PUrrxchj';
const POSTHOG_CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const INSTALL_ID_KEY = 'ytqf_analyticsInstallId';
const SNAPSHOT_SENT_AT_KEY = 'ytqf_analyticsSnapshotSentAt';
const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FILTERS_KEY_PREFIX = 'ytQuickFilters_';

let installIdPromise: Promise<string> | undefined;

// Memoized so concurrent callers (startup, install, messages) never generate two ids.
const getInstallId = (): Promise<string> => {
  installIdPromise ??= (async () => {
    const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
    const existing = stored[INSTALL_ID_KEY];
    if (typeof existing === 'string' && existing) return existing;

    const id = crypto.randomUUID();
    await chrome.storage.local.set({ [INSTALL_ID_KEY]: id });
    return id;
  })();
  return installIdPromise;
};

const pickAllowedProperties = (properties: AnalyticsProperties): AnalyticsProperties =>
  Object.fromEntries(
    ALLOWED_PROPERTY_KEYS.filter((key) => properties[key] !== undefined).map((key) => [
      key,
      properties[key],
    ]),
  );

const sendEvent = async (event: string, properties: AnalyticsProperties): Promise<void> => {
  if (!POSTHOG_API_KEY) return;

  const body = {
    api_key: POSTHOG_API_KEY,
    event,
    distinct_id: await getInstallId(),
    timestamp: new Date().toISOString(),
    properties: {
      ...pickAllowedProperties(properties),
      extension_version: chrome.runtime.getManifest().version,
      // Anonymous events only: no person profiles and no IP-based geolocation.
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };

  // text/plain keeps this a simple CORS request, so no extra host permission is needed.
  await fetch(POSTHOG_CAPTURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
};

chrome.runtime.onMessage.addListener((message: Partial<AnalyticsMessage> | undefined) => {
  if (message?.type !== ANALYTICS_MESSAGE_TYPE || !message.event) return;

  sendEvent(message.event, message.properties ?? {}).catch((error) => {
    console.warn('Failed to send analytics event:', error);
  });
});

// Current settings, sent at most once a day, so we see what people have set and not only what they click.
const sendSettingsSnapshotIfDue = async (): Promise<void> => {
  if (!POSTHOG_API_KEY) return;

  const { [SNAPSHOT_SENT_AT_KEY]: sentAt } = await chrome.storage.local.get(SNAPSHOT_SENT_AT_KEY);
  if (typeof sentAt === 'number' && Date.now() - sentAt < SNAPSHOT_INTERVAL_MS) return;
  await chrome.storage.local.set({ [SNAPSHOT_SENT_AT_KEY]: Date.now() });

  const settings = await chrome.storage.sync.get(null);
  const totalFilterCount = Object.entries(settings)
    .filter(([key, value]) => key.startsWith(FILTERS_KEY_PREFIX) && Array.isArray(value))
    .reduce((total, [, filters]) => total + (filters as unknown[]).length, 0);

  await sendEvent('settings_snapshot', {
    combine_filters: settings.ytqf_allowMultipleFilters ?? DEFAULT_ALLOW_MULTIPLE_FILTERS,
    time_badges_button: settings.ytqf_showDaysInStatusButton ?? false,
    created_tag: !(settings.ytqf_hideCreatedTag ?? false),
    created_tag_colored: settings.ytqf_createdTagColored ?? false,
    theme: settings.ytqf_colorTheme ?? DEFAULT_COLOR_THEME,
    total_filter_count: totalFilterCount,
  });
};

let snapshotInFlight: Promise<void> | undefined;

const trySendSettingsSnapshot = (): void => {
  snapshotInFlight ??= sendSettingsSnapshotIfDue()
    .catch((error) => {
      console.warn('Failed to send settings snapshot:', error);
    })
    .finally(() => {
      snapshotInFlight = undefined;
    });
};

chrome.runtime.onStartup.addListener(trySendSettingsSnapshot);
chrome.runtime.onInstalled.addListener(trySendSettingsSnapshot);
trySendSettingsSnapshot();

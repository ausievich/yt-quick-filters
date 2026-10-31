import {
  ANALYTICS_MESSAGE_TYPE,
  AnalyticsMessage,
  AnalyticsProperties,
} from './services/analytics';

// PostHog project API key (a public write-only key). Leave empty to disable sending.
const POSTHOG_API_KEY = '';
const POSTHOG_CAPTURE_URL = 'https://us.i.posthog.com/capture/';
const INSTALL_ID_KEY = 'ytqf_analyticsInstallId';

const getInstallId = async (): Promise<string> => {
  const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
  const existing = stored[INSTALL_ID_KEY];
  if (typeof existing === 'string' && existing) return existing;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALL_ID_KEY]: id });
  return id;
};

const sendEvent = async (event: string, properties: AnalyticsProperties): Promise<void> => {
  if (!POSTHOG_API_KEY) return;

  const body = {
    api_key: POSTHOG_API_KEY,
    event,
    distinct_id: await getInstallId(),
    timestamp: new Date().toISOString(),
    properties: {
      action: properties.action,
      filter_count: properties.filter_count,
      enabled: properties.enabled,
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

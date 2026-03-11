const DEFAULT_INGESTION_ENDPOINT = 'https://dc.services.visualstudio.com';
const USER_ID_KEY = 'is-ai-native-user-id';
const SESSION_ID_KEY = 'is-ai-native-session-id';
const SESSION_STARTED_KEY = 'is-ai-native-session-started';

let settings = null;

function normalizeProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function normalizeMeasurements(measurements = {}) {
  return Object.fromEntries(
    Object.entries(measurements).filter(([, value]) => Number.isFinite(value))
  );
}

function parseConnectionString(connectionString) {
  if (!connectionString) {
    return null;
  }

  const entries = connectionString
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [key, ...rest] = segment.split('=');
      return [key, rest.join('=')];
    });

  const config = Object.fromEntries(entries);
  if (!config.InstrumentationKey) {
    return null;
  }

  return {
    instrumentationKey: config.InstrumentationKey,
    ingestionEndpoint: (config.IngestionEndpoint || DEFAULT_INGESTION_ENDPOINT).replace(/\/+$/, ''),
  };
}

function makeId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateStorageValue(storage, key) {
  try {
    const existing = storage.getItem(key);
    if (existing) {
      return existing;
    }

    const next = makeId();
    storage.setItem(key, next);
    return next;
  } catch {
    return makeId();
  }
}

function getUserId() {
  return getOrCreateStorageValue(window.localStorage, USER_ID_KEY);
}

function getSessionId() {
  return getOrCreateStorageValue(window.sessionStorage, SESSION_ID_KEY);
}

function buildEnvelope(baseType, baseData, operationId = makeId()) {
  if (!settings) {
    return null;
  }

  return {
    name: `Microsoft.ApplicationInsights.${baseType === 'PageviewData' ? 'Pageview' : 'Event'}`,
    time: new Date().toISOString(),
    iKey: settings.instrumentationKey,
    tags: {
      'ai.cloud.role': 'is-ai-native-frontend',
      'ai.operation.id': operationId,
      'ai.user.id': getUserId(),
      'ai.session.id': getSessionId(),
    },
    data: {
      baseType,
      baseData,
    },
  };
}

async function sendEnvelope(envelope) {
  if (!settings || !envelope) {
    return;
  }

  const url = `${settings.ingestionEndpoint}/v2/track`;
  const payload = JSON.stringify([envelope]);

  if (navigator.sendBeacon) {
    try {
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    } catch {
      // Continue to fetch fallback.
    }
  }

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      body: payload,
      keepalive: true,
    });
  } catch {
    // Ignore telemetry transport failures to avoid impacting UX.
  }
}

export function trackUiEvent(eventName, properties = {}, measurements = {}) {
  const envelope = buildEnvelope('EventData', {
    ver: 2,
    name: eventName,
    properties: normalizeProperties(properties),
    measurements: normalizeMeasurements(measurements),
  });

  return sendEnvelope(envelope);
}

export function trackPageView(pageName = document.title, properties = {}, measurements = {}) {
  const envelope = buildEnvelope('PageviewData', {
    ver: 2,
    name: pageName,
    url: window.location.href,
    properties: normalizeProperties({
      path: window.location.pathname,
      referrer: document.referrer || '',
      ...properties,
    }),
    measurements: normalizeMeasurements(measurements),
  });

  return sendEnvelope(envelope);
}

function markSessionStarted() {
  try {
    if (window.sessionStorage.getItem(SESSION_STARTED_KEY) === '1') {
      return false;
    }

    window.sessionStorage.setItem(SESSION_STARTED_KEY, '1');
    return true;
  } catch {
    return true;
  }
}

export function initTelemetry(config = {}) {
  settings = parseConnectionString(config.appInsightsConnectionString);

  if (!settings) {
    return false;
  }

  trackPageView(document.title, {
    route: window.location.pathname,
  });

  if (markSessionStarted()) {
    trackUiEvent('session_started', {
      route: window.location.pathname,
    });
  }

  return true;
}

export function disableTelemetry() {
  settings = null;
}

export function clearTelemetryIdentity() {
  try {
    window.localStorage.removeItem(USER_ID_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }

  try {
    window.sessionStorage.removeItem(SESSION_ID_KEY);
    window.sessionStorage.removeItem(SESSION_STARTED_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

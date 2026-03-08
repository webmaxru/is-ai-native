import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_INGESTION_ENDPOINT = 'https://dc.services.visualstudio.com';
const CLOUD_ROLE = 'is-ai-native-backend';

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

export function parseConnectionString(connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
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

export function isAppInsightsEnabled() {
  return parseConnectionString() !== null;
}

export function buildScanKey(result) {
  const input = [result?.repo_url || '', result?.scanned_at || '', String(result?.score ?? '')].join('|');
  return createHash('sha256').update(input).digest('hex');
}

export function buildEventEnvelope(eventName, properties = {}, measurements = {}, options = {}) {
  const settings = options.settings || parseConnectionString();
  if (!settings) {
    return null;
  }

  const operationId = options.operationId || randomUUID();

  return {
    name: 'Microsoft.ApplicationInsights.Event',
    time: options.time || new Date().toISOString(),
    iKey: settings.instrumentationKey,
    tags: {
      'ai.cloud.role': CLOUD_ROLE,
      'ai.operation.id': operationId,
    },
    data: {
      baseType: 'EventData',
      baseData: {
        ver: 2,
        name: eventName,
        properties: normalizeProperties(properties),
        measurements: normalizeMeasurements(measurements),
      },
    },
  };
}

async function sendEnvelope(envelope, settings) {
  const ingestionUrl = `${settings.ingestionEndpoint}/v2/track`;
  const response = await fetch(ingestionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([envelope]),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Application Insights ingestion failed with status ${response.status}${responseText ? `: ${responseText}` : ''}`);
  }
}

async function trackEvent(eventName, properties = {}, measurements = {}) {
  const settings = parseConnectionString();
  if (!settings) {
    return false;
  }

  const envelope = buildEventEnvelope(eventName, properties, measurements, { settings });
  if (!envelope) {
    return false;
  }

  try {
    await sendEnvelope(envelope, settings);
    return true;
  } catch (err) {
    console.warn(`Application Insights telemetry failed for ${eventName}: ${err.message}`);
    return false;
  }
}

export async function trackScanCompleted(result, { durationMs } = {}) {
  return trackEvent(
    'scan_completed',
    {
      repo_url: result.repo_url,
      repo_name: result.repo_name,
      verdict: result.verdict,
      scan_key: buildScanKey(result),
      scanned_at: result.scanned_at,
    },
    {
      score: result.score,
      stars: result.stars,
      duration_ms: durationMs,
    }
  );
}

export async function trackScanFailed({ repoUrl, repoName, reason, statusCode, durationMs, errorName } = {}) {
  return trackEvent(
    'scan_failed',
    {
      repo_url: repoUrl,
      repo_name: repoName,
      reason,
      status_code: statusCode,
      error_name: errorName,
    },
    {
      duration_ms: durationMs,
    }
  );
}

export async function trackReportCreated(result, { reportId } = {}) {
  return trackEvent(
    'report_created',
    {
      report_id: reportId,
      repo_url: result.repo_url,
      repo_name: result.repo_name,
      verdict: result.verdict,
      scan_key: buildScanKey(result),
      scanned_at: result.scanned_at,
    },
    {
      score: result.score,
      stars: result.stars,
    }
  );
}

export async function trackSharedReportViewed(result, { reportId } = {}) {
  return trackEvent(
    'shared_report_viewed',
    {
      report_id: reportId,
      repo_url: result.repo_url,
      repo_name: result.repo_name,
      verdict: result.verdict,
      scan_key: buildScanKey(result),
      scanned_at: result.scanned_at,
    },
    {
      score: result.score,
      stars: result.stars,
    }
  );
}
import { jest } from '@jest/globals';
import {
  buildEventEnvelope,
  buildScanKey,
  isAppInsightsEnabled,
  parseConnectionString,
  trackRateLimitHit,
  trackReportCreated,
  trackSharedReportViewed,
  trackScanCompleted,
} from '../../src/services/app-insights.js';

const originalFetch = global.fetch;
const originalConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

const sampleResult = {
  repo_url: 'https://github.com/owner/repo',
  repo_name: 'owner/repo',
  score: 75,
  verdict: 'AI-Native',
  stars: 42,
  scanned_at: '2026-03-08T10:00:00.000Z',
};

afterEach(() => {
  global.fetch = originalFetch;
  if (originalConnectionString === undefined) {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  } else {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalConnectionString;
  }
  jest.restoreAllMocks();
});

describe('parseConnectionString', () => {
  it('extracts instrumentation key and ingestion endpoint', () => {
    const parsed = parseConnectionString(
      'InstrumentationKey=test-key;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/'
    );

    expect(parsed).toEqual({
      instrumentationKey: 'test-key',
      ingestionEndpoint: 'https://westeurope-5.in.applicationinsights.azure.com',
    });
  });

  it('returns null when the connection string is absent or invalid', () => {
    expect(parseConnectionString('')).toBeNull();
    expect(parseConnectionString('IngestionEndpoint=https://example.com')).toBeNull();
  });
});

describe('buildScanKey', () => {
  it('is deterministic for identical scan results', () => {
    expect(buildScanKey(sampleResult)).toBe(buildScanKey(sampleResult));
  });

  it('changes when the scan timestamp changes', () => {
    expect(buildScanKey(sampleResult)).not.toBe(
      buildScanKey({ ...sampleResult, scanned_at: '2026-03-08T10:00:01.000Z' })
    );
  });
});

describe('telemetry sending', () => {
  it('reports disabled telemetry when no connection string is configured', async () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    expect(isAppInsightsEnabled()).toBe(false);
    await expect(trackScanCompleted(sampleResult, { durationMs: 123 })).resolves.toBe(false);
  });

  it('posts the expected scan-completed envelope shape', async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      'InstrumentationKey=test-key;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    await trackScanCompleted(sampleResult, { durationMs: 321 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://westeurope-5.in.applicationinsights.azure.com/v2/track');
    expect(options.method).toBe('POST');

    const [payload] = JSON.parse(options.body);
    expect(payload.name).toBe('Microsoft.ApplicationInsights.Event');
    expect(payload.iKey).toBe('test-key');
    expect(payload.data.baseType).toBe('EventData');
    expect(payload.data.baseData.name).toBe('scan_completed');
    expect(payload.data.baseData.properties.repo_name).toBe('owner/repo');
    expect(payload.data.baseData.properties.verdict).toBe('AI-Native');
    expect(payload.data.baseData.measurements.score).toBe(75);
    expect(payload.data.baseData.measurements.duration_ms).toBe(321);
  });

  it('posts report-created telemetry with correlation fields', async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      'InstrumentationKey=test-key;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    await trackReportCreated(sampleResult, { reportId: 'abc-123' });

    const [payload] = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.data.baseData.name).toBe('report_created');
    expect(payload.data.baseData.properties.report_id).toBe('abc-123');
    expect(payload.data.baseData.properties.scan_key).toBe(buildScanKey(sampleResult));
  });

  it('posts shared-report-viewed telemetry with correlation fields', async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      'InstrumentationKey=test-key;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    await trackSharedReportViewed(sampleResult, { reportId: 'abc-123' });

    const [payload] = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.data.baseData.name).toBe('shared_report_viewed');
    expect(payload.data.baseData.properties.report_id).toBe('abc-123');
    expect(payload.data.baseData.properties.scan_key).toBe(buildScanKey(sampleResult));
  });

  it('posts rate-limit-hit telemetry with hashed client context', async () => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
      'InstrumentationKey=test-key;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    await trackRateLimitHit({
      policyName: 'scan_api',
      route: '/api/scan',
      method: 'POST',
      ip: '203.0.113.10',
      limit: 120,
      remaining: 0,
      retryAfterSeconds: 900,
      windowMs: 900000,
    });

    const [payload] = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.data.baseData.name).toBe('rate_limit_hit');
    expect(payload.data.baseData.properties.policy_name).toBe('scan_api');
    expect(payload.data.baseData.properties.route).toBe('/api/scan');
    expect(payload.data.baseData.properties.method).toBe('POST');
    expect(payload.data.baseData.properties.client_hash).toHaveLength(64);
    expect(payload.data.baseData.measurements.limit).toBe(120);
    expect(payload.data.baseData.measurements.retry_after_seconds).toBe(900);
  });

  it('builds an envelope directly for deterministic inspection', () => {
    const envelope = buildEventEnvelope(
      'scan_completed',
      { repo_name: 'owner/repo' },
      { score: 75 },
      {
        settings: {
          instrumentationKey: 'test-key',
          ingestionEndpoint: 'https://dc.services.visualstudio.com',
        },
        operationId: 'fixed-operation-id',
        time: '2026-03-08T10:00:00.000Z',
      }
    );

    expect(envelope).toEqual({
      name: 'Microsoft.ApplicationInsights.Event',
      time: '2026-03-08T10:00:00.000Z',
      iKey: 'test-key',
      tags: {
        'ai.cloud.role': 'is-ai-native-backend',
        'ai.operation.id': 'fixed-operation-id',
      },
      data: {
        baseType: 'EventData',
        baseData: {
          ver: 2,
          name: 'scan_completed',
          properties: { repo_name: 'owner/repo' },
          measurements: { score: 75 },
        },
      },
    });
  });
});
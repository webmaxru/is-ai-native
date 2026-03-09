process.env.NODE_ENV = 'test';
process.env.REPORTS_DIR = ':memory:';

let request;
let app;

beforeAll(async () => {
  const [supertest, serverModule] = await Promise.all([
    import('supertest'),
    import('../../src/server.js'),
  ]);
  request = supertest.default;
  app = serverModule.default;
});

describe('GET /health', () => {
  describe('when GH_TOKEN_FOR_SCAN is not set and sharing is disabled', () => {
    beforeEach(() => {
      delete process.env.GH_TOKEN_FOR_SCAN;
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      process.env.ENABLE_SHARING = 'false';
    });

    it('returns status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('reports githubTokenProvided as false', async () => {
      const res = await request(app).get('/health');
      expect(res.body.githubTokenProvided).toBe(false);
    });

    it('reports sharingEnabled as false', async () => {
      const res = await request(app).get('/health');
      expect(res.body.sharingEnabled).toBe(false);
    });

    it('reports appInsightsEnabled as false', async () => {
      const res = await request(app).get('/health');
      expect(res.body.appInsightsEnabled).toBe(false);
    });
  });

  describe('when GH_TOKEN_FOR_SCAN is set and sharing is enabled', () => {
    beforeEach(() => {
      process.env.GH_TOKEN_FOR_SCAN = 'ghp_testtoken';
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=test-key;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/';
      process.env.ENABLE_SHARING = 'true';
    });

    afterEach(() => {
      delete process.env.GH_TOKEN_FOR_SCAN;
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      process.env.ENABLE_SHARING = 'false';
    });

    it('reports githubTokenProvided as true', async () => {
      const res = await request(app).get('/health');
      expect(res.body.githubTokenProvided).toBe(true);
    });

    it('reports sharingEnabled as true', async () => {
      const res = await request(app).get('/health');
      expect(res.body.sharingEnabled).toBe(true);
    });

    it('reports appInsightsEnabled as true', async () => {
      const res = await request(app).get('/health');
      expect(res.body.appInsightsEnabled).toBe(true);
    });
  });
});

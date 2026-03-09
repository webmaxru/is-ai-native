process.env.NODE_ENV = 'test';

describe('resolveFrontendPath', () => {
  it('resolves a relative FRONTEND_PATH from the current working directory', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');

    expect(resolveFrontendPath('../frontend')).toMatch(/frontend$/);
  });

  it('falls back to the repository frontend directory when no override is provided', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');

    expect(resolveFrontendPath()).toMatch(/frontend$/);
  });
});
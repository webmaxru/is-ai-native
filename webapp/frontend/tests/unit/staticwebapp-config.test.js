import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(
  readFileSync(new URL('../../staticwebapp.config.json', import.meta.url), 'utf8')
);

test('Static Web Apps routes remain unique after trailing-slash normalization', () => {
  const normalizedRoutes = config.routes.map(({ route }) =>
    route === '/' ? route : route.replace(/\/+$/, '')
  );

  assert.equal(new Set(normalizedRoutes).size, normalizedRoutes.length);
});

test('Static Web Apps rewrites the WebMCP route to its dedicated page', () => {
  assert.deepEqual(
    config.routes.find(({ route }) => route === '/_webmcp_'),
    {
      route: '/_webmcp_',
      rewrite: '/webmcp.html',
    }
  );
});

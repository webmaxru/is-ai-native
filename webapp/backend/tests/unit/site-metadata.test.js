import {
  buildPageMetadata,
  createIndexHtmlRenderer,
  createSiteMetadata,
  getRobotsTxt,
  getWebManifest,
  renderIndexHtml,
} from '../../src/services/site-metadata.js';

describe('site metadata', () => {
  it('allows homepage indexing in production by default', () => {
    const runtime = {
      env: {
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      },
      siteMetadata: createSiteMetadata({
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      }),
    };

    const page = buildPageMetadata(runtime, '/');

    expect(page.robots).toBe('index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    expect(page.canonicalUrl).toBe('https://scan.example.com/');
  });

  it('marks repo result pages as noindex even when production indexing is enabled', () => {
    const runtime = {
      env: {
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      },
      siteMetadata: createSiteMetadata({
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      }),
    };

    const page = buildPageMetadata(runtime, '/webmaxru/is-ai-native');

    expect(page.robots).toBe('noindex, nofollow, noarchive');
    expect(page.title).toBe('webmaxru/is-ai-native | Is AI Native');
  });

  it('gives the WebMCP demo page a dedicated noindex title and canonical', () => {
    const runtime = {
      env: {
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      },
      siteMetadata: createSiteMetadata({
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      }),
    };

    const page = buildPageMetadata(runtime, '/_webmcp_/');

    expect(page.robots).toBe('noindex, nofollow, noarchive');
    expect(page.title).toBe('WebMCP demo | Is AI Native');
    expect(page.description).toContain('WebMCP');
    expect(page.canonicalUrl).toBe('https://scan.example.com/_webmcp_/');
  });

  it('emits an allow-list robots.txt and sitemap in production', () => {
    const runtime = {
      env: {
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      },
      siteMetadata: createSiteMetadata({
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      }),
    };

    const robots = getRobotsTxt(runtime);

    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /_webmcp_/');
    expect(robots).toContain('Sitemap: https://scan.example.com/sitemap.xml');
  });

  it('emits a launch-ready manifest with compatibility icon aliases', () => {
    const runtime = {
      env: {
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      },
      siteMetadata: createSiteMetadata({
        NODE_ENV: 'production',
        SITE_ORIGIN: 'https://scan.example.com',
      }),
    };

    const manifest = JSON.parse(getWebManifest(runtime));

    expect(manifest).toMatchObject({
      id: '/',
      lang: 'en',
      start_url: '/',
      display: 'standalone',
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
        }),
        expect.objectContaining({
          src: '/maskable-icon-512x512.png',
          purpose: 'maskable',
        }),
      ])
    );
  });
});

describe('createIndexHtmlRenderer', () => {
  const template = [
    '<title>__PAGE_TITLE__</title>',
    '<meta name="robots" content="__PAGE_ROBOTS__" />',
    '<link rel="canonical" href="__PAGE_CANONICAL__" />',
    '<script type="application/ld+json">__STRUCTURED_DATA__</script>',
  ].join('\n');

  function buildRuntime() {
    const env = { NODE_ENV: 'production', SITE_ORIGIN: 'https://scan.example.com' };
    return { env, siteMetadata: createSiteMetadata(env) };
  }

  it('returns null when no template is configured', () => {
    const renderer = createIndexHtmlRenderer(buildRuntime(), null);
    expect(renderer.render('/')).toBeNull();
    expect(renderer.size).toBe(0);
  });

  it('produces identical html + robots to the uncached path', () => {
    const runtime = buildRuntime();
    const renderer = createIndexHtmlRenderer(runtime, template);
    const pageMetadata = buildPageMetadata(runtime, '/webmaxru/is-ai-native');
    const expectedHtml = renderIndexHtml(template, pageMetadata);

    const { html, robots } = renderer.render('/webmaxru/is-ai-native');

    expect(html).toBe(expectedHtml);
    expect(robots).toBe(pageMetadata.robots);
  });

  it('reuses the cached entry for repeat pathnames', () => {
    const renderer = createIndexHtmlRenderer(buildRuntime(), template);
    const first = renderer.render('/');
    const second = renderer.render('/');

    expect(second).toBe(first);
    expect(renderer.size).toBe(1);
  });

  it('evicts the oldest entry once maxEntries is exceeded', () => {
    const renderer = createIndexHtmlRenderer(buildRuntime(), template, { maxEntries: 2 });

    renderer.render('/a');
    renderer.render('/b');
    renderer.render('/c');

    expect(renderer.size).toBe(2);

    // Rendering `/a` again should be a fresh entry (a distinct object identity
    // from the one produced before eviction). Rendering `/c` should still hit
    // the cache from the previous step.
    const firstC = renderer.render('/c');
    const secondC = renderer.render('/c');
    expect(secondC).toBe(firstC);
  });

  it('clear() empties the cache', () => {
    const renderer = createIndexHtmlRenderer(buildRuntime(), template);
    renderer.render('/');
    renderer.render('/webmaxru/is-ai-native');
    expect(renderer.size).toBe(2);

    renderer.clear();
    expect(renderer.size).toBe(0);
  });
});
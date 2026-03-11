import {
  buildPageMetadata,
  createSiteMetadata,
  getRobotsTxt,
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
    expect(page.title).toBe('webmaxru/is-ai-native | IsAINative');
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
    expect(robots).toContain('Sitemap: https://scan.example.com/sitemap.xml');
  });
});
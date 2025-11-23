import { normalizePageSlug, resolvePageSlug } from './slug.util';

describe('slug utils', () => {
  it('normalizes arbitrary strings into safe slugs', () => {
    expect(normalizePageSlug('Docs + API')).toBe('docs-api');
  });

  it('prefers explicit slug input when provided', () => {
    expect(resolvePageSlug('Ignored', 'Custom Route')).toBe('custom-route');
  });

  it('falls back to name when slug missing', () => {
    expect(resolvePageSlug('Marketing Page')).toBe('marketing-page');
  });
});

import { deriveDefaultPageName, normalizeRouteSegment } from './routes';

describe('route helpers', () => {
  it('normalizes whitespace and casing in routes', () => {
    expect(normalizeRouteSegment(' Docs Home ')).toBe('docs-home');
  });

  it('removes invalid characters and squashes delimiters', () => {
    expect(normalizeRouteSegment('🔥Beta Release🔥')).toBe('beta-release');
    expect(normalizeRouteSegment('user//settings///advanced')).toBe('user/settings/advanced');
  });

  it('falls back to name when explicit slug missing', () => {
    expect(normalizeRouteSegment(undefined, 'Marketing Page')).toBe('marketing-page');
  });

  it('returns default route when nothing is left', () => {
    expect(normalizeRouteSegment('!!!')).toBe('page');
  });

  it('derives sequential default names', () => {
    expect(deriveDefaultPageName(0)).toBe('Page 1');
    expect(deriveDefaultPageName(4)).toBe('Page 5');
  });
});

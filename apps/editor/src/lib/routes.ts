const FALLBACK_ROUTE = 'page';
const MAX_SLUG_LENGTH = 48;

const sanitizeCandidate = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/(^-|-$)+/g, '')
    .replace(/(\/-+|-+\/)/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/(^-|-$)+/g, '');
};

export const normalizeRouteSegment = (value?: string, fallback?: string): string => {
  const seed = value?.trim().length ? value : fallback ?? '';
  const normalized = sanitizeCandidate(seed);
  if (normalized) {
    return normalized;
  }
  return FALLBACK_ROUTE;
};

export const deriveDefaultPageName = (existingPageCount: number): string => `Page ${existingPageCount + 1}`;

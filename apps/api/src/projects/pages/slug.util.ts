const MAX_SLUG_LENGTH = 48;

const sanitizeCandidate = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/(^-|-$)+/g, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/(^-|-$)+/g, '');

export const normalizePageSlug = (value: string): string => sanitizeCandidate(value);

export const resolvePageSlug = (name: string, slugInput?: string): string => {
  const candidate = slugInput?.trim().length ? normalizePageSlug(slugInput) : normalizePageSlug(name);
  if (candidate) {
    return candidate;
  }
  return `page-${Math.random().toString(36).slice(2, 6)}`;
};

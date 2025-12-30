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

export const normalizeComponentSlug = (value: string): string => sanitizeCandidate(value);

export const resolveComponentSlug = (name: string, slugInput?: string): string => {
  const candidate = slugInput?.trim().length ? normalizeComponentSlug(slugInput) : normalizeComponentSlug(name);
  if (candidate) {
    return candidate;
  }
  return `component-${Math.random().toString(36).slice(2, 6)}`;
};

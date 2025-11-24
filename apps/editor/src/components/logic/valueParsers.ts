import { ScalarValue } from '@buildweaver/libs';

export const parseScalarList = (value: string): ScalarValue[] =>
  value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry === 'true' || entry === 'false') {
        return entry === 'true';
      }
      const numeric = Number(entry);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
      return entry;
    });

export const stringifyScalarList = (value: ScalarValue[] = []): string =>
  value.map((entry) => String(entry ?? '')).join('\n');

export const parseKeyValuePairs = (value: string): Record<string, ScalarValue> => {
  const pairs = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split('=');
      return { key: key?.trim() ?? '', value: rest.join('=').trim() };
    })
    .filter(({ key }) => key.length > 0);

  return pairs.reduce<Record<string, ScalarValue>>((acc, { key, value: raw }) => {
    if (raw === 'true' || raw === 'false') {
      acc[key] = raw === 'true';
      return acc;
    }
    const numeric = Number(raw);
    acc[key] = Number.isNaN(numeric) ? raw : numeric;
    return acc;
  }, {});
};

export const stringifyKeyValuePairs = (value: Record<string, ScalarValue> = {}): string =>
  Object.entries(value)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

import type { Data } from '@measured/puck';
import type { PageDynamicInput } from '../../types/api';

const STORAGE_PREFIX = 'bw-preview:';
const STORAGE_TTL_MS = 5 * 60 * 1000;

type BuilderPreviewSnapshot = {
  state: Data;
  inputs: PageDynamicInput[];
  createdAt: number;
};

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const createToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const serializeSnapshot = (snapshot: BuilderPreviewSnapshot): string => JSON.stringify(snapshot);

const deserializeSnapshot = (raw: string): BuilderPreviewSnapshot | null => {
  try {
    const parsed = JSON.parse(raw) as BuilderPreviewSnapshot;
    if (!parsed || typeof parsed.createdAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const prunePreviewSnapshots = (now: number = Date.now()) => {
  if (!isBrowser()) {
    return;
  }
  const storage = window.localStorage;
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(STORAGE_PREFIX)) {
      continue;
    }
    const raw = storage.getItem(key);
    if (!raw) {
      storage.removeItem(key);
      continue;
    }
    const snapshot = deserializeSnapshot(raw);
    if (!snapshot || now - snapshot.createdAt > STORAGE_TTL_MS) {
      storage.removeItem(key);
    }
  }
};

export const createPreviewSnapshotToken = (state: Data, inputs: PageDynamicInput[]): string | null => {
  if (!isBrowser()) {
    return null;
  }
  prunePreviewSnapshots();
  const token = createToken();
  const payload: BuilderPreviewSnapshot = {
    state,
    inputs,
    createdAt: Date.now()
  };
  window.localStorage.setItem(`${STORAGE_PREFIX}${token}`, serializeSnapshot(payload));
  return token;
};

export const consumePreviewSnapshot = (token: string): BuilderPreviewSnapshot | null => {
  if (!isBrowser()) {
    return null;
  }
  const storageKey = `${STORAGE_PREFIX}${token}`;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }
  window.localStorage.removeItem(storageKey);
  return deserializeSnapshot(raw);
};

import type { PageBuilderState, PageDynamicInput } from '../../types/api';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BuilderDraft = {
  savedAt: number;
  state: PageBuilderState;
  dynamicInputs: PageDynamicInput[];
};

const STORAGE_PREFIX = 'bw-ui-builder:';

const getStorage = (provided?: StorageLike | null): StorageLike | undefined => {
  if (provided) {
    return provided;
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }
  return window.localStorage;
};

export const buildDraftKey = (sessionKey: string) => `${STORAGE_PREFIX}${sessionKey}`;

export const persistBuilderDraft = (
  sessionKey: string,
  state: PageBuilderState,
  dynamicInputs: PageDynamicInput[],
  storage?: StorageLike | null
): number | null => {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return null;
  }
  const payload: BuilderDraft = { savedAt: Date.now(), state, dynamicInputs };
  safeStorage.setItem(buildDraftKey(sessionKey), JSON.stringify(payload));
  return payload.savedAt;
};

export const loadBuilderDraft = (
  sessionKey: string,
  storage?: StorageLike | null
): BuilderDraft | null => {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return null;
  }
  const raw = safeStorage.getItem(buildDraftKey(sessionKey));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as BuilderDraft;
    if (!parsed?.state) {
      throw new Error('Invalid payload');
    }
    return {
      savedAt: parsed.savedAt,
      state: parsed.state,
      dynamicInputs: Array.isArray(parsed.dynamicInputs) ? parsed.dynamicInputs : []
    };
  } catch (error) {
    safeStorage.removeItem(buildDraftKey(sessionKey));
    console.warn('[PageBuilder] failed to parse draft payload', error);
    return null;
  }
};

export const clearBuilderDraft = (sessionKey: string, storage?: StorageLike | null): void => {
  const safeStorage = getStorage(storage);
  if (!safeStorage) {
    return;
  }
  safeStorage.removeItem(buildDraftKey(sessionKey));
};

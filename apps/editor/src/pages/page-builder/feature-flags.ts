const FLAG_PREFIX = '[PageBuilder:FeatureFlags]';

const rawSlotParamFlag = (
  (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__VITE_ENABLE_SLOT_PARAMETERS__) as
    | string
    | undefined
) ?? (typeof process !== 'undefined' ? process.env?.VITE_ENABLE_SLOT_PARAMETERS : undefined);

export const ENABLE_SLOT_PARAMETERS = rawSlotParamFlag === 'true';

export const logFeatureFlagEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }
  console.info(`${FLAG_PREFIX} ${message}`, { flag: 'VITE_ENABLE_SLOT_PARAMETERS', enabled: ENABLE_SLOT_PARAMETERS, ...details });
};

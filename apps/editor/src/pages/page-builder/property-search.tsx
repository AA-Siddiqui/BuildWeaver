import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { CustomField, FieldProps } from '@measured/puck';

const PROPERTY_SEARCH_LOG_PREFIX = '[PageBuilder:PropertySearch]';
export const PROPERTY_SEARCH_FIELD_KEY = '__uiPropertySearch' as const;

type PropertySearchSnapshot = {
  query: string;
  matchCount: number;
};

type Listener = () => void;

type FieldMatchRegistry = Map<string, boolean>;

type PropertySearchStore = {
  getState: () => PropertySearchSnapshot;
  subscribe: (listener: Listener) => () => void;
  setQuery: (next: string) => void;
  setFieldMatch: (id: string, matches: boolean) => void;
  removeFieldMatch: (id: string) => void;
  reset: () => void;
};

const logPropertySearchEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }
  console.info(`${PROPERTY_SEARCH_LOG_PREFIX} ${message}`, details ?? '');
};

const createPropertySearchStore = (): PropertySearchStore => {
  let state: PropertySearchSnapshot = { query: '', matchCount: 0 };
  const listeners = new Set<Listener>();
  const registry: FieldMatchRegistry = new Map();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const computeMatchCount = () => {
    return Array.from(registry.values()).filter(Boolean).length;
  };

  const notifyMatchCount = () => {
    const nextMatchCount = computeMatchCount();
    if (nextMatchCount === state.matchCount) {
      return;
    }
    state = { ...state, matchCount: nextMatchCount };
    if (state.query.trim()) {
      logPropertySearchEvent('Match count recalculated', { query: state.query, matchCount: nextMatchCount });
    }
    emit();
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const setQuery = (next: string) => {
    if (state.query === next) {
      return;
    }
    state = { ...state, query: next };
    logPropertySearchEvent('Query updated', {
      query: next,
      normalizedQuery: next.trim().toLowerCase()
    });
    emit();
  };

  const setFieldMatch = (id: string, matches: boolean) => {
    registry.set(id, matches);
    notifyMatchCount();
  };

  const removeFieldMatch = (id: string) => {
    if (!registry.delete(id)) {
      return;
    }
    notifyMatchCount();
  };

  const reset = () => {
    registry.clear();
    state = { query: '', matchCount: 0 };
    emit();
  };

  return {
    getState: () => state,
    subscribe,
    setQuery,
    setFieldMatch,
    removeFieldMatch,
    reset
  };
};

const propertySearchStore = createPropertySearchStore();

const usePropertySearchStore = () =>
  useSyncExternalStore(propertySearchStore.subscribe, propertySearchStore.getState, propertySearchStore.getState);

const PROPERTY_FIELD_ATTR = 'data-property-search-field';
const PROPERTY_FIELD_VISIBLE_ATTR = 'data-property-search-visible';
const PROPERTY_FIELD_HIDDEN_ATTR = 'data-property-search-hidden';
const PROPERTY_FIELD_ORIGINAL_DISPLAY_ATTR = 'data-property-search-original-display';

const applyHostVisibility = (host: HTMLElement, isVisible: boolean, fieldKey: string) => {
  if (!host) {
    return;
  }
  host.setAttribute(PROPERTY_FIELD_ATTR, fieldKey);
  host.setAttribute(PROPERTY_FIELD_VISIBLE_ATTR, String(isVisible));
  if (isVisible) {
    host.removeAttribute(PROPERTY_FIELD_HIDDEN_ATTR);
    const previousDisplay = host.getAttribute(PROPERTY_FIELD_ORIGINAL_DISPLAY_ATTR);
    if (previousDisplay !== null) {
      host.style.display = previousDisplay;
      host.removeAttribute(PROPERTY_FIELD_ORIGINAL_DISPLAY_ATTR);
    } else {
      host.style.removeProperty('display');
    }
    return;
  }
  if (!host.hasAttribute(PROPERTY_FIELD_ORIGINAL_DISPLAY_ATTR)) {
    host.setAttribute(PROPERTY_FIELD_ORIGINAL_DISPLAY_ATTR, host.style.display || '');
  }
  host.style.display = 'none';
  host.setAttribute(PROPERTY_FIELD_HIDDEN_ATTR, 'true');
};

export const updatePropertySearchQuery = (value: string) => {
  propertySearchStore.setQuery(value);
};

export const clearPropertySearchQuery = () => {
  propertySearchStore.setQuery('');
};

export const resetPropertySearchState = () => {
  propertySearchStore.reset();
};

type PropertyFilterGuardProps = {
  fieldKey: string;
  label?: string;
  keywords?: string[];
  children: ReactNode;
};

const normalizeNeedle = (value: string) => value.trim().toLowerCase();

const resolveFieldHost = (node: HTMLDivElement | null): HTMLElement | null => {
  if (!node) {
    return null;
  }
  const initialParent = node.parentElement;
  let current: HTMLElement | null = initialParent;
  let depth = 0;
  while (current && depth < 5) {
    const className = typeof current.className === 'string' ? current.className : '';
    if (
      current.hasAttribute(PROPERTY_FIELD_ATTR) ||
      current.hasAttribute(PROPERTY_FIELD_VISIBLE_ATTR) ||
      current.hasAttribute('data-field') ||
      current.dataset?.puckField ||
      className.toLowerCase().includes('field')
    ) {
      return current;
    }
    current = current.parentElement;
    depth += 1;
  }
  return initialParent;
};

export const PropertyFilterGuard = ({ fieldKey, label, keywords = [], children }: PropertyFilterGuardProps) => {
  const guardId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const warnedMissingHostRef = useRef(false);
  const previousVisibilityRef = useRef<boolean | null>(null);
  const latestMatchRef = useRef<boolean>(true);
  const { query } = usePropertySearchStore();
  const normalizedQuery = normalizeNeedle(query);

  const haystacks = [label ?? '', fieldKey, ...keywords]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  const matches = normalizedQuery ? haystacks.some((value) => value.includes(normalizedQuery)) : true;
  latestMatchRef.current = matches;

  useEffect(() => {
    propertySearchStore.setFieldMatch(guardId, matches);
    return () => {
      propertySearchStore.removeFieldMatch(guardId);
    };
  }, [guardId, matches]);

  useLayoutEffect(() => {
    const host = resolveFieldHost(wrapperRef.current);
    if (!host) {
      if (!warnedMissingHostRef.current) {
        logPropertySearchEvent('Field host element missing', { fieldKey });
        warnedMissingHostRef.current = true;
      }
      return;
    }
    hostRef.current = host;
    warnedMissingHostRef.current = false;
    const initialVisibility = latestMatchRef.current;
    applyHostVisibility(host, initialVisibility, fieldKey);
    previousVisibilityRef.current = initialVisibility;
    return () => {
      applyHostVisibility(host, true, fieldKey);
      host.removeAttribute(PROPERTY_FIELD_ATTR);
      host.removeAttribute(PROPERTY_FIELD_VISIBLE_ATTR);
      host.removeAttribute(PROPERTY_FIELD_HIDDEN_ATTR);
      host.removeAttribute(PROPERTY_FIELD_ORIGINAL_DISPLAY_ATTR);
      hostRef.current = null;
      previousVisibilityRef.current = null;
    };
  }, [fieldKey]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    if (previousVisibilityRef.current === matches) {
      return;
    }
    applyHostVisibility(host, matches, fieldKey);
    previousVisibilityRef.current = matches;
    logPropertySearchEvent('Field host visibility updated', { fieldKey, visible: matches });
  }, [fieldKey, matches]);

  return (
    <div ref={wrapperRef} data-property-field={fieldKey} style={{ display: 'contents' }}>
      {matches ? children : null}
    </div>
  );
};

type PropertySearchFieldProps = FieldProps<CustomField<string>, string>;

export const PropertySearchFieldControl = ({ id, readOnly }: PropertySearchFieldProps) => {
  const inputId = id ?? useId();
  const { query, matchCount } = usePropertySearchStore();
  const normalizedQuery = normalizeNeedle(query);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      return;
    }
    updatePropertySearchQuery(event.target.value);
  };

  const handleClear = () => {
    if (readOnly) {
      return;
    }
    clearPropertySearchQuery();
  };

  return (
    <div className="space-y-2" aria-live="polite">
      <label
        className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500"
        htmlFor={inputId}
      >
        Search properties
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="search"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed"
          placeholder="Search properties"
          value={query}
          onChange={handleChange}
          disabled={readOnly}
          aria-label="Search properties"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 text-xs font-semibold text-bw-amber"
            aria-label="Clear property search"
            disabled={readOnly}
          >
            Clear
          </button>
        ) : null}
      </div>
      {normalizedQuery && matchCount === 0 ? (
        <p className="text-xs text-gray-500">No properties match "{query}".</p>
      ) : null}
    </div>
  );
};

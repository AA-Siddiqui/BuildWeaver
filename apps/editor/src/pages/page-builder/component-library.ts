import type { ComponentData, Data } from '@measured/puck';
import type { ComponentBindingReference } from '@buildweaver/libs';
import { isDynamicBindingValue, type DynamicBindingValue } from './dynamic-binding';
import { ENABLE_SLOT_PARAMETERS, logFeatureFlagEvent } from './feature-flags';
import { PROPERTY_SEARCH_FIELD_KEY } from './property-search';

export const COMPONENT_ACTIONS_FIELD_KEY = '__uiComponentActions';

const COMPONENT_LIBRARY_LOG_PREFIX = '[PageBuilder:ComponentLibrary]';

const logComponentLibraryEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }
  console.info(`${COMPONENT_LIBRARY_LOG_PREFIX} ${message}`, details ?? '');
};

const INTERNAL_PROP_KEYS = new Set<string>([PROPERTY_SEARCH_FIELD_KEY, COMPONENT_ACTIONS_FIELD_KEY]);

const isComponentData = (value: unknown): value is ComponentData =>
  Boolean(value && typeof value === 'object' && 'type' in (value as Record<string, unknown>) && 'props' in (value as Record<string, unknown>));

const cloneComponent = (component: ComponentData): ComponentData => JSON.parse(JSON.stringify(component));

const stripInternalProps = (props: ComponentData['props']) => {
  const cleaned: ComponentData['props'] = { ...(props ?? {}) };
  INTERNAL_PROP_KEYS.forEach((key) => {
    delete cleaned[key as keyof ComponentData['props']];
  });
  return cleaned;
};

const sanitizeValue = (value: unknown): unknown => {
  if (isComponentData(value)) {
    return sanitizeComponent(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      next[key] = sanitizeValue(entry);
    });
    return next;
  }
  return value;
};

const sanitizeComponent = (component: ComponentData): ComponentData => {
  const cloned = cloneComponent(component);
  cloned.props = stripInternalProps(cloned.props ?? {});
  cloned.props = sanitizeValue(cloned.props) as ComponentData['props'];
  return cloned;
};

const collectChildComponents = (value: unknown, collector: ComponentData[]) => {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectChildComponents(entry, collector));
    return;
  }
  if (isComponentData(value)) {
    collector.push(value);
    return;
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectChildComponents(entry, collector));
  }
};

const visitForId = (value: unknown, targetId: string): ComponentData | undefined => {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const match = visitForId(entry, targetId);
      if (match) {
        return match;
      }
    }
    return undefined;
  }
  if (value instanceof Map) {
    for (const entry of value.values()) {
      const match = visitForId(entry, targetId);
      if (match) {
        return match;
      }
    }
    return undefined;
  }
  if (isComponentData(value)) {
    if ((value.props as Record<string, unknown>)?.id === targetId) {
      return value;
    }
    return visitForId(value.props, targetId);
  }
  if (typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const match = visitForId(entry, targetId);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
};

export const findComponentById = (data: Data | undefined, componentId?: string): ComponentData | undefined => {
  if (!data || !componentId) {
    return undefined;
  }
  const fromContent = visitForId(data.content, componentId);
  if (fromContent) {
    return fromContent;
  }
  if (data.zones) {
    const zones = data.zones instanceof Map ? Array.from(data.zones.values()) : Object.values(data.zones);
    for (const zoneContent of zones) {
      const match = visitForId(zoneContent, componentId);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
};

export const normalizeComponentDefinition = (component: ComponentData | undefined): ComponentData | undefined => {
  if (!component) {
    return undefined;
  }
  return sanitizeComponent(component);
};

export const buildBindingSignature = (ref: ComponentBindingReference): string => {
  const path = ref.propertyPath?.join('.') ?? '';
  const component = ref.componentId ?? '';
  return `${ref.bindingId}:${path}:${component}`;
};

export const resolveComponentRootId = (component: ComponentData | undefined): string | undefined => {
  if (!component) {
    return undefined;
  }
  const id = (component.props as Record<string, unknown>)?.id;
  return typeof id === 'string' && id.trim().length ? id : undefined;
};

export const isSlotBindingReference = (ref: ComponentBindingReference, rootId?: string | null): boolean => {
  const hasRoot = Boolean(rootId && String(rootId).trim().length);
  const hasComponent = Boolean(ref.componentId && ref.componentId.trim().length);
  if (!hasRoot || !hasComponent) {
    return false;
  }
  const isSlot = ref.componentId !== rootId;
  if (isSlot && !ENABLE_SLOT_PARAMETERS) {
    logFeatureFlagEvent('Slot parameter encountered while flag disabled', { signature: buildBindingSignature(ref) });
  }
  return isSlot;
};

type ParameterOverrideValue = DynamicBindingValue | string | undefined;

export const mergeParameterOverrides = (
  parameters: ComponentBindingReference[],
  propOverrides: Record<string, unknown> | undefined,
  existingOverrides: Record<string, ParameterOverrideValue> = {},
  log = logComponentLibraryEvent
): Record<string, ParameterOverrideValue> => {
  const merged: Record<string, ParameterOverrideValue> = { ...existingOverrides };
  parameters.forEach((parameter) => {
    const signature = buildBindingSignature(parameter);
    const candidate = propOverrides?.[signature] as ParameterOverrideValue;
    if (typeof candidate !== 'undefined') {
      merged[signature] = candidate;
      log?.('Parameter override captured from props', { signature });
      return;
    }
    if (signature in merged) {
      log?.('Parameter override using existing value', { signature });
    } else {
      log?.('Parameter override missing; using template default', { signature });
    }
  });
  return merged;
};

export const collectDynamicBindings = (component: ComponentData | undefined): ComponentBindingReference[] => {
  if (!component) {
    return [];
  }
  const results: ComponentBindingReference[] = [];
  const seen = new Set<string>();

  const visitValue = (value: unknown, current: ComponentData) => {
    if (isDynamicBindingValue(value)) {
      const bindingId = value.bindingId;
      const propertyPath = value.propertyPath;
      const signature = `${bindingId}:${propertyPath?.join('.') ?? ''}:${(current.props as Record<string, unknown>)?.id ?? ''}`;
      if (!seen.has(signature)) {
        seen.add(signature);
        results.push({
          bindingId,
          propertyPath,
          componentId: (current.props as Record<string, unknown>)?.id as string | undefined,
          componentType: current.type
        });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (isComponentData(entry)) {
          visitComponent(entry);
          return;
        }
        visitValue(entry, current);
      });
      return;
    }
    if (isComponentData(value)) {
      visitComponent(value);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach((entry) => visitValue(entry, current));
    }
  };

  const visitComponent = (node: ComponentData) => {
    visitValue(node.props, node);
    const children: ComponentData[] = [];
    collectChildComponents(node.props, children);
    children.forEach((child) => visitComponent(child));
  };

  visitComponent(component);
  return results;
};

export const cloneComponentDefinition = (component: ComponentData | undefined): ComponentData | undefined => {
  if (!component) {
    return undefined;
  }
  return cloneComponent(component);
};

export const applyParameterOverrides = (
  definition: ComponentData | undefined,
  overrides: Record<string, DynamicBindingValue | string | undefined>,
  parameters: ComponentBindingReference[]
): ComponentData | undefined => {
  if (!definition || !parameters.length) {
    return definition;
  }
  const parameterSignatures = new Set(parameters.map(buildBindingSignature));
  const appliedSignatures = new Set<string>();

  function applyOverrideToValue(value: unknown, context: { componentId?: string; componentType?: string }): unknown {
    if (isDynamicBindingValue(value)) {
      const ref: ComponentBindingReference = {
        bindingId: value.bindingId,
        propertyPath: value.propertyPath,
        componentId: context.componentId,
        componentType: context.componentType
      };
      const signature = buildBindingSignature(ref);
      if (!parameterSignatures.has(signature)) {
        logComponentLibraryEvent('Dynamic value encountered without parameter flag', { signature });
        return value;
      }
      const override = overrides[signature];
      if (typeof override === 'undefined') {
        logComponentLibraryEvent('Parameter override missing; keeping source binding', { signature });
        return value;
      }
      appliedSignatures.add(signature);
      logComponentLibraryEvent('Parameter override applied', { signature });
      return override as DynamicBindingValue | string;
    }
    if (isComponentData(value)) {
      return walkComponent(value);
    }
    if (Array.isArray(value)) {
      return value.map((entry) => applyOverrideToValue(entry, context));
    }
    if (value && typeof value === 'object') {
      const next: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        next[key] = applyOverrideToValue(entry, context);
      });
      return next;
    }
    return value;
  }

  function walkComponent(node: ComponentData): ComponentData {
    const cloned = cloneComponent(node);
    const componentId = (cloned.props as Record<string, unknown>)?.id as string | undefined;
    cloned.props = applyOverrideToValue(cloned.props, {
      componentId,
      componentType: cloned.type
    }) as ComponentData['props'];
    return cloned;
  }

  const result = walkComponent(definition);
  if (appliedSignatures.size === 0) {
    logComponentLibraryEvent('No parameter overrides applied', {
      parameters: parameters.length,
      availableOverrides: Object.keys(overrides ?? {}).length
    });
  }
  return result;
};

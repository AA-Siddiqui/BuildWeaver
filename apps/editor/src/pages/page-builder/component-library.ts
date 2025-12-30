import type { ComponentData, Data } from '@measured/puck';
import type { ComponentBindingReference } from '@buildweaver/libs';
import { isDynamicBindingValue } from './dynamic-binding';
import { PROPERTY_SEARCH_FIELD_KEY } from './property-search';

export const COMPONENT_ACTIONS_FIELD_KEY = '__uiComponentActions';

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

import type { ComponentData, Data } from '@measured/puck';
import type { ScalarValue } from '@buildweaver/libs';
import { isDynamicBindingValue, type BindingOption, type DynamicBindingValue } from './dynamic-binding';
import { LIST_SCOPE_BINDING_PREFIX } from './list-slot-context';
import type { ListScopeBindingLookup } from './list-scope-binding-context';
import type { PageDynamicInputDataType } from '@buildweaver/libs';

const isComponentData = (value: unknown): value is ComponentData =>
  Boolean(value && typeof value === 'object' && 'type' in (value as Record<string, unknown>) && 'props' in (value as Record<string, unknown>));

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

const deriveDataType = (value: ScalarValue | undefined): PageDynamicInputDataType | undefined => {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return 'list';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  return 'string';
};

const unwrapScalar = (value?: DynamicBindingValue): ScalarValue | undefined => {
  if (isDynamicBindingValue(value)) {
    return value.fallback ?? '';
  }
  return value as ScalarValue;
};

const deriveManualSample = (items?: Array<Record<string, DynamicBindingValue | string | undefined>>): ScalarValue | undefined => {
  if (!items || !items.length) {
    return undefined;
  }
  const first = items[0];
  const sample: Record<string, ScalarValue> = {};
  Object.entries(first ?? {}).forEach(([key, entryValue]) => {
    sample[key] = unwrapScalar(entryValue as DynamicBindingValue) ?? '';
  });
  return sample;
};

const deriveDynamicSample = (
  dataSource: DynamicBindingValue | undefined,
  previewMap: Map<string, ScalarValue>
): ScalarValue | undefined => {
  if (!isDynamicBindingValue(dataSource)) {
    return undefined;
  }
  const resolved = previewMap.get(dataSource.bindingId);
  if (!Array.isArray(resolved) || !resolved.length) {
    return undefined;
  }
  return resolved[0] as ScalarValue;
};

const buildScopeBindingOption = (
  listComponentId: string,
  sample: ScalarValue | undefined,
  sourceBindingId?: string
): BindingOption => {
  const dataType = deriveDataType(sample);
  const bindingValue = `${LIST_SCOPE_BINDING_PREFIX}${listComponentId}`;
  return {
    label: 'Current list item',
    value: bindingValue,
    dataType,
    objectSample: typeof sample === 'object' && sample !== null && !Array.isArray(sample) ? (sample as Record<string, ScalarValue>) : undefined,
    previewValue: typeof sample === 'string' || typeof sample === 'number' || typeof sample === 'boolean' ? sample : undefined,
    scope: {
      type: 'listItem',
      listComponentId,
      sourceBindingId
    }
  };
};

type ListScopeMeta = {
  listComponentId: string;
  option: BindingOption;
};

const resolveListScopeMeta = (
  component: ComponentData,
  previewMap: Map<string, ScalarValue>
): ListScopeMeta | undefined => {
  if (component.type !== 'List') {
    return undefined;
  }
  const props = component.props as Record<string, unknown>;
  const rawMode = props.renderMode;
  const resolvedMode = typeof rawMode === 'string' ? rawMode : isDynamicBindingValue(rawMode) ? rawMode.fallback ?? 'builtIn' : 'builtIn';
  if (resolvedMode !== 'custom') {
    return undefined;
  }
  const slotContent = props.customItemSlot;
  if (!Array.isArray(slotContent) || !slotContent.some((entry) => isComponentData(entry))) {
    return undefined;
  }
  const listComponentId = (props.id as string) ?? undefined;
  if (!listComponentId) {
    return undefined;
  }
  const dataSource = props.dataSource as DynamicBindingValue | undefined;
  const sample = deriveDynamicSample(dataSource, previewMap) ??
    deriveManualSample(props.items as Array<Record<string, DynamicBindingValue | string | undefined>> | undefined);
  const sourceBindingId = isDynamicBindingValue(dataSource) ? dataSource.bindingId : undefined;
  const option = buildScopeBindingOption(listComponentId, sample, sourceBindingId);
  return { listComponentId, option };
};

export const buildListScopeBindingLookup = (
  data: Data | undefined,
  previewMap: Map<string, ScalarValue>
): ListScopeBindingLookup => {
  const lookup: ListScopeBindingLookup = new Map();
  if (!data) {
    return lookup;
  }

  const visit = (component: ComponentData, activeScope?: ListScopeMeta) => {
    const componentId = (component.props as Record<string, unknown>)?.id as string | undefined;
    if (activeScope && componentId) {
      const existing = lookup.get(componentId) ?? [];
      lookup.set(componentId, existing.some((entry) => entry.value === activeScope.option.value) ? existing : existing.concat(activeScope.option));
    }

    const nextScope = resolveListScopeMeta(component, previewMap) ?? activeScope;
    const children: ComponentData[] = [];
    collectChildComponents(component.props, children);
    children.forEach((child) => visit(child, nextScope));
  };

  data.content?.forEach((component) => visit(component));
  if (data.zones) {
    Object.values(data.zones).forEach((zoneContent) => {
      zoneContent?.forEach((component) => visit(component));
    });
  }
  return lookup;
};

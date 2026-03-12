import type { DynamicBindingState, PageDynamicInputInfo, PuckComponentData, PuckData } from './types';

const LOG_PREFIX = '[Codegen:BindingResolver]';

export const isDynamicBinding = (value: unknown): value is DynamicBindingState => {
  if (!value || typeof value !== 'object') return false;
  return (value as DynamicBindingState).__bwDynamicBinding === true;
};

const toSafeIdentifier = (label: string): string => {
  const cleaned = label
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/(^_|_$)/g, '');
  if (!cleaned) return 'value';
  return /^\d/.test(cleaned) ? `_${cleaned}` : cleaned;
};

export const generateBindingExpression = (
  binding: DynamicBindingState,
  dynamicInputs: PageDynamicInputInfo[]
): string => {
  const input = dynamicInputs.find((i) => i.id === binding.bindingId);
  const label = input ? toSafeIdentifier(input.label) : toSafeIdentifier(binding.bindingId);

  let expr = `pageData?.${label}`;
  if (binding.propertyPath?.length) {
    const pathExpr = binding.propertyPath.map((seg) => `?.${toSafeIdentifier(seg)}`).join('');
    expr = `pageData?.${label}${pathExpr}`;
  }

  if (binding.fallback) {
    return `(${expr}) ?? ${JSON.stringify(binding.fallback)}`;
  }
  return expr;
};

export const resolveTextContent = (
  value: unknown,
  dynamicInputs: PageDynamicInputInfo[]
): { isExpression: boolean; text: string } => {
  if (isDynamicBinding(value)) {
    const expr = generateBindingExpression(value, dynamicInputs);
    return { isExpression: true, text: expr };
  }
  if (typeof value === 'string') {
    return { isExpression: false, text: value };
  }
  return { isExpression: false, text: '' };
};

const isInlineSlotArray = (value: unknown): value is PuckComponentData[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.type === 'string' &&
      item.props !== null &&
      typeof item.props === 'object'
  );
};

const walkComponentProps = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>,
  bindingIds: Set<string>
): void => {
  for (const [key, value] of Object.entries(component.props)) {
    if (isDynamicBinding(value)) {
      bindingIds.add(value.bindingId);
    }
    // Walk inline slot arrays (Puck v0.16+ stores slot children in props)
    if (key !== 'id' && isInlineSlotArray(value)) {
      for (const child of value) {
        walkComponentProps(child, zones, bindingIds);
      }
    }
    // Walk cases array with nested slots (Conditional component)
    if (key === 'cases' && Array.isArray(value)) {
      for (const caseItem of value) {
        if (caseItem && typeof caseItem === 'object') {
          const caseObj = caseItem as Record<string, unknown>;
          if (isInlineSlotArray(caseObj.slot)) {
            for (const child of caseObj.slot) {
              walkComponentProps(child, zones, bindingIds);
            }
          }
        }
      }
    }
  }

  const componentId = component.props.id as string | undefined;
  if (!componentId) return;

  for (const [zoneKey, children] of Object.entries(zones)) {
    if (zoneKey.startsWith(`${componentId}:`)) {
      for (const child of children) {
        walkComponentProps(child, zones, bindingIds);
      }
    }
  }
};

export const collectPageBindings = (
  puckData: PuckData | undefined
): Set<string> => {
  const bindingIds = new Set<string>();
  if (!puckData?.content) {
    console.info(`${LOG_PREFIX} No puck data content to scan for bindings`);
    return bindingIds;
  }

  const zones = puckData.zones ?? {};
  for (const component of puckData.content) {
    walkComponentProps(component, zones, bindingIds);
  }

  console.info(`${LOG_PREFIX} Collected ${bindingIds.size} unique binding(s) from page`, {
    bindingIds: [...bindingIds]
  });
  return bindingIds;
};

export const resolveBindingIdToLabel = (
  bindingId: string,
  dynamicInputs: PageDynamicInputInfo[]
): string => {
  const input = dynamicInputs.find((i) => i.id === bindingId);
  return input ? toSafeIdentifier(input.label) : toSafeIdentifier(bindingId);
};

import {
  ArithmeticNodeData,
  DummyNodeData,
  ListNodeData,
  ObjectNodeData,
  ScalarValue,
  StringNodeData
} from '@buildweaver/libs';
import { logicLogger } from '../../lib/logger';

export type PreviewState = 'unknown' | 'ready' | 'error';

export interface NodePreview<T = unknown> {
  state: PreviewState;
  heading: string;
  summary: string;
  value?: T;
}

const clampList = (items: ScalarValue[], limit = 5) => items.slice(0, limit);

export const formatScalar = (
  value: ScalarValue | ScalarValue[] | Record<string, ScalarValue> | undefined
): string => {
  if (value === null || value === undefined) {
    return '∅';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => formatScalar(entry as ScalarValue)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 0);
  }
  if (typeof value === 'string') {
    return value === '' ? '""' : value;
  }
  return String(value);
};

const requireSamples = <T>(values: (T | null | undefined)[]): values is T[] => {
  const allProvided = values.every((value) => value !== null && value !== undefined);
  return allProvided;
};

export const evaluateDummyPreview = (data: DummyNodeData): NodePreview => {
  return {
    state: 'ready',
    heading: `${data.sample.type} sample`,
    summary: formatScalar(data.sample.value as ScalarValue | ScalarValue[] | Record<string, ScalarValue>),
    value: data.sample.value
  };
};

export type ArithmeticInputOverrides = Record<string, number | null | undefined>;

export const evaluateArithmeticPreview = (
  data: ArithmeticNodeData,
  overrides: ArithmeticInputOverrides = {}
): NodePreview<number> => {
  const operandValues = data.operands.map((operand) => {
    const override = overrides[operand.id];
    if (override !== undefined) {
      return override;
    }
    return operand.sampleValue ?? null;
  });
  if (!requireSamples<number>(operandValues)) {
    return {
      state: 'unknown',
      heading: 'Awaiting Inputs',
      summary: 'Provide numeric samples to preview the result.'
    };
  }

  try {
    const [first, ...rest] = operandValues;
    let result = first;
    switch (data.operation) {
      case 'add':
        result = operandValues.reduce((acc, value) => acc + value, 0);
        break;
      case 'subtract':
        result = rest.reduce((acc, value) => acc - value, first);
        break;
      case 'multiply':
        result = operandValues.reduce((acc, value) => acc * value, 1);
        break;
      case 'divide':
        result = rest.reduce((acc, value) => (value === 0 ? acc : acc / value), first);
        break;
      case 'modulo':
        result = rest.reduce((acc, value) => (value === 0 ? acc : acc % value), first);
        break;
      case 'average':
        result = operandValues.reduce((acc, value) => acc + value, 0) / operandValues.length;
        break;
      case 'min':
        result = Math.min(...operandValues);
        break;
      case 'max':
        result = Math.max(...operandValues);
        break;
      default:
        result = first;
    }

    const rounded = Number(result.toFixed(data.precision));
    return {
      state: 'ready',
      heading: 'Result',
      summary: rounded.toString(),
      value: rounded
    };
  } catch (error) {
    logicLogger.error('Failed to generate arithmetic preview', { error: (error as Error).message });
    return {
      state: 'error',
      heading: 'Error',
      summary: 'Unable to evaluate with provided samples.'
    };
  }
};

export type StringInputOverrides = Record<string, string | undefined>;

export const evaluateStringPreview = (
  data: StringNodeData,
  overrides: StringInputOverrides = {}
): NodePreview<string | number> => {
  const values = data.stringInputs.map((input) => overrides[input.id] ?? input.sampleValue ?? '');
  const primary = values[0] ?? '';

  try {
    switch (data.operation) {
      case 'concat': {
        const delimiter = data.options?.delimiter ?? '';
        const concatenated = values.filter((value) => value !== '').join(delimiter);
        return { state: 'ready', heading: 'Concatenated', summary: concatenated, value: concatenated };
      }
      case 'uppercase': {
        const result = primary.toUpperCase();
        return { state: 'ready', heading: 'Uppercase', summary: result, value: result };
      }
      case 'lowercase': {
        const result = primary.toLowerCase();
        return { state: 'ready', heading: 'Lowercase', summary: result, value: result };
      }
      case 'trim': {
        const result = primary.trim();
        return { state: 'ready', heading: 'Trimmed', summary: result, value: result };
      }
      case 'slice': {
        const start = data.options?.start ?? 0;
        const end = data.options?.end ?? primary.length;
        const result = primary.slice(start, end);
        return { state: 'ready', heading: 'Slice', summary: result, value: result };
      }
      case 'replace': {
        const search = data.options?.search ?? '';
        const replace = data.options?.replace ?? '';
        const result = search ? primary.replace(new RegExp(search, 'g'), replace) : primary;
        return { state: 'ready', heading: 'Replace', summary: result, value: result };
      }
      case 'length': {
        return { state: 'ready', heading: 'Length', summary: `${primary.length}`, value: primary.length };
      }
      default:
        return {
          state: 'unknown',
          heading: 'No preview',
          summary: 'Operation not recognized.'
        };
    }
  } catch (error) {
    logicLogger.error('Failed to generate string preview', { error: (error as Error).message });
    return { state: 'error', heading: 'Error', summary: 'Unable to evaluate string operation.' };
  }
};

export type ListInputOverrides = Partial<Record<'primarySample' | 'secondarySample', ScalarValue[]>>;

export const evaluateListPreview = (
  data: ListNodeData,
  overrides: ListInputOverrides = {}
): NodePreview<ScalarValue[] | number> => {
  const primary = overrides.primarySample ?? data.primarySample ?? [];
  const secondary = overrides.secondarySample ?? data.secondarySample ?? [];
  const limit = Math.min(data.limit ?? 5, 5);

  try {
    switch (data.operation) {
      case 'append': {
        const appended = clampList(primary.concat(secondary), limit);
        return { state: 'ready', heading: 'Append', summary: formatScalar(appended), value: appended };
      }
      case 'merge': {
        const merged = clampList(primary.concat(secondary), limit);
        return { state: 'ready', heading: 'Merge', summary: formatScalar(merged), value: merged };
      }
      case 'slice':
      case 'take': {
        const sliceEnd = Math.min(limit, primary.length);
        const sliced = clampList(primary.slice(0, sliceEnd), limit);
        return { state: 'ready', heading: 'Slice', summary: formatScalar(sliced), value: sliced };
      }
      case 'unique': {
        const unique = clampList(Array.from(new Set(primary)), limit);
        return { state: 'ready', heading: 'Unique', summary: formatScalar(unique), value: unique };
      }
      case 'sort': {
        const sorted = [...primary].sort((a, b) => {
          if (a === b) return 0;
          if (a === null) return -1;
          if (b === null) return 1;
          if (typeof a === 'number' && typeof b === 'number') {
            return data.sort === 'desc' ? Number(b) - Number(a) : Number(a) - Number(b);
          }
          return data.sort === 'desc'
            ? String(b ?? '').localeCompare(String(a ?? ''))
            : String(a ?? '').localeCompare(String(b ?? ''));
        });
        const clipped = clampList(sorted, limit);
        return { state: 'ready', heading: 'Sorted', summary: formatScalar(clipped), value: clipped };
      }
      case 'length': {
        return { state: 'ready', heading: 'Length', summary: `${primary.length}`, value: primary.length };
      }
      default:
        return { state: 'unknown', heading: 'No preview', summary: 'Operation not recognized.' };
    }
  } catch (error) {
    logicLogger.error('Failed to generate list preview', { error: (error as Error).message });
    return { state: 'error', heading: 'Error', summary: 'Unable to evaluate list operation.' };
  }
};

const resolvePath = (source: Record<string, ScalarValue>, path?: string) => {
  if (!path) {
    return undefined;
  }
  return source[path];
};

export type ObjectInputOverrides = Partial<
  Record<'sourceSample' | 'patchSample', Record<string, ScalarValue>>
>;

export const evaluateObjectPreview = (
  data: ObjectNodeData,
  overrides: ObjectInputOverrides = {}
): NodePreview => {
  const source = overrides.sourceSample ?? data.sourceSample ?? {};
  const patch = overrides.patchSample ?? data.patchSample ?? {};

  try {
    switch (data.operation) {
      case 'merge': {
        const merged = { ...source, ...patch };
        return { state: 'ready', heading: 'Merged', summary: formatScalar(merged), value: merged };
      }
      case 'pick': {
        const picked = (data.selectedKeys ?? []).reduce<Record<string, ScalarValue>>((acc, key) => {
          if (key in source) {
            acc[key] = source[key];
          }
          return acc;
        }, {});
        return { state: 'ready', heading: 'Picked', summary: formatScalar(picked), value: picked };
      }
      case 'set': {
        if (!data.path) {
          return { state: 'unknown', heading: 'Awaiting Path', summary: 'Provide a key to preview the result.' };
        }
        if (data.path.includes('.')) {
          return {
            state: 'unknown',
            heading: 'Unsupported Path',
            summary: 'Nested keys are not supported in preview samples.'
          };
        }
        const next = { ...source } as Record<string, ScalarValue>;
        next[data.path] = (patch as Record<string, ScalarValue>)[data.path] ?? null;
        return { state: 'ready', heading: 'Set', summary: formatScalar(next), value: next };
      }
      case 'get': {
        const resolved = resolvePath(source, data.path);
        if (resolved === undefined) {
          return { state: 'unknown', heading: 'No data', summary: 'Path not found in sample.' };
        }
        return { state: 'ready', heading: 'Lookup', summary: formatScalar(resolved as ScalarValue), value: resolved };
      }
      case 'keys': {
        const keys = Object.keys(source);
        return { state: 'ready', heading: 'Keys', summary: formatScalar(keys), value: keys };
      }
      case 'values': {
        const values = Object.values(source).map((value) => formatScalar(value as ScalarValue));
        return { state: 'ready', heading: 'Values', summary: formatScalar(values), value: values };
      }
      default:
        return { state: 'unknown', heading: 'No preview', summary: 'Operation not recognized.' };
    }
  } catch (error) {
    logicLogger.error('Failed to generate object preview', { error: (error as Error).message });
    return { state: 'error', heading: 'Error', summary: 'Unable to evaluate object operation.' };
  }
};

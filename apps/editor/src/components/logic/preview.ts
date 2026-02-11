import {
  ArithmeticNodeData,
  ConditionalNodeData,
  DummyNodeData,
  FunctionReferenceValue,
  ListNodeData,
  LogicalOperatorNodeData,
  ObjectNodeData,
  RelationalOperatorNodeData,
  ScalarValue,
  StringNodeData,
  StringNodeInputRole
} from '@buildweaver/libs';
import { logicLogger } from '../../lib/logger';

export type PreviewState = 'unknown' | 'ready' | 'error';

/** Describes a single column in the output shape of a query node. */
export interface QueryColumnShape {
  name: string;
  type: string;
  table?: string;
}

export interface NodePreview<T = unknown> {
  state: PreviewState;
  heading: string;
  summary: string;
  value?: T;
  /** Output column shape – populated for query nodes only. */
  dataShape?: QueryColumnShape[];
  /** Generated SQL fragment or full query – populated for query nodes only. */
  sql?: string;
}

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

const coerceNumberValue = (value: ScalarValue | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return undefined;
};

const areScalarValuesEqual = (left: ScalarValue | undefined, right: ScalarValue | undefined): boolean => {
  if (left === right) {
    return true;
  }
  if (typeof left !== typeof right) {
    return false;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (error) {
    logicLogger.warn('Failed to compare scalar values', {
      leftType: typeof left,
      rightType: typeof right,
      message: (error as Error).message
    });
    return false;
  }
};

const isScalarValue = (value: unknown): value is ScalarValue => {
  if (value === null) {
    return true;
  }
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isScalarValue(entry));
  }
  if (valueType === 'object') {
    return Object.values(value as Record<string, unknown>).every((entry) => isScalarValue(entry));
  }
  return false;
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

export interface ConditionalInputOverrides {
  condition?: boolean;
  truthy?: ScalarValue;
  falsy?: ScalarValue;
}

export const evaluateConditionalPreview = (
  data: ConditionalNodeData,
  overrides: ConditionalInputOverrides = {}
): NodePreview<ScalarValue | undefined> => {
  const condition = overrides.condition ?? data.conditionSample;
  if (condition === undefined) {
    return {
      state: 'unknown',
      heading: 'Awaiting condition',
      summary: 'Provide a boolean sample or connect a condition input.'
    };
  }

  const truthyValue = overrides.truthy ?? data.trueValue;
  const falsyValue = overrides.falsy ?? data.falseValue;
  const selectedValue = condition ? truthyValue : falsyValue;

  if (selectedValue === undefined) {
    return {
      state: 'unknown',
      heading: condition ? 'Missing true branch' : 'Missing false branch',
      summary: 'Add a sample value or connect another node.'
    };
  }

  return {
    state: 'ready',
    heading: condition ? 'True branch' : 'False branch',
    summary: formatScalar(selectedValue as ScalarValue),
    value: selectedValue
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
    const missingOperands = data.operands
      .map((operand, index) => ({ operand, value: operandValues[index] }))
      .filter(({ value }) => value === null || value === undefined)
      .map(({ operand }) => operand.id);
    logicLogger.warn('Arithmetic preview awaiting operands', {
      operation: data.operation,
      missingOperands
    });
    return {
      state: 'unknown',
      heading: 'Awaiting Inputs',
      summary: 'Provide numeric samples to preview the result.'
    };
  }

  logicLogger.debug('Arithmetic preview inputs ready', {
    operation: data.operation,
    operands: operandValues,
    precision: data.precision
  });

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
        result = rest.reduce((acc, value, index) => {
          if (value === 0) {
            logicLogger.warn('Division by zero skipped in arithmetic preview', {
              operation: data.operation,
              operandId: data.operands[index + 1]?.id
            });
            return acc;
          }
          return acc / value;
        }, first);
        break;
      case 'exponent': {
        if (rest.length === 0) {
          logicLogger.warn('Exponent operation missing exponent operand', { operation: data.operation });
          break;
        }
        if (rest.length > 1) {
          logicLogger.warn('Exponent operation received extra operands', {
            operation: data.operation,
            operandCount: operandValues.length
          });
        }
        const exponent = rest[0];
        result = Math.pow(first, exponent);
        break;
      }
      case 'modulo':
        result = rest.reduce((acc, value, index) => {
          if (value === 0) {
            logicLogger.warn('Modulo by zero skipped in arithmetic preview', {
              operation: data.operation,
              operandId: data.operands[index + 1]?.id
            });
            return acc;
          }
          return acc % value;
        }, first);
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

    if (!Number.isFinite(result)) {
      logicLogger.warn('Arithmetic preview produced a non-finite result', {
        operation: data.operation,
        operands: operandValues
      });
      return {
        state: 'error',
        heading: 'Invalid Result',
        summary: 'Result is not finite.'
      };
    }

    const rounded = Number(result.toFixed(data.precision));
    logicLogger.debug('Arithmetic preview resolved', {
      operation: data.operation,
      result: rounded,
      precision: data.precision
    });
    return {
      state: 'ready',
      heading: 'Result',
      summary: rounded.toString(),
      value: rounded
    };
  } catch (error) {
    logicLogger.error('Failed to generate arithmetic preview', {
      error: (error as Error).message,
      operation: data.operation
    });
    return {
      state: 'error',
      heading: 'Error',
      summary: 'Unable to evaluate with provided samples.'
    };
  }
};

export interface LogicalInputOverrides {
  primary?: boolean;
  secondary?: boolean;
}

export const evaluateLogicalOperatorPreview = (
  data: LogicalOperatorNodeData,
  overrides: LogicalInputOverrides = {}
): NodePreview<boolean> => {
  const primary = overrides.primary ?? data.primarySample;
  if (primary === undefined) {
    return {
      state: 'unknown',
      heading: 'Awaiting primary input',
      summary: 'Connect or sample the first boolean input.'
    };
  }

  if (data.operation === 'not') {
    return {
      state: 'ready',
      heading: 'NOT',
      summary: (!primary).toString(),
      value: !primary
    };
  }

  const secondary = overrides.secondary ?? data.secondarySample;
  if (secondary === undefined) {
    return {
      state: 'unknown',
      heading: 'Awaiting secondary input',
      summary: 'Connect or sample the second boolean input.'
    };
  }

  let value = false;
  if (data.operation === 'and') {
    value = Boolean(primary && secondary);
  } else if (data.operation === 'or') {
    value = Boolean(primary || secondary);
  } else {
    logicLogger.warn('Unknown logical operator encountered', { operation: data.operation });
  }

  return {
    state: 'ready',
    heading: data.operation.toUpperCase(),
    summary: value.toString(),
    value
  };
};

export type StringInputOverrides = Record<string, string | undefined>;

type StringRoleBuckets = Partial<Record<StringNodeInputRole, string[]>>;

const getStringInputRole = (inputRole?: StringNodeInputRole): StringNodeInputRole => inputRole ?? 'text';

const bucketizeStringInputs = (data: StringNodeData, overrides: StringInputOverrides): StringRoleBuckets => {
  return data.stringInputs.reduce<StringRoleBuckets>((acc, input) => {
    const role = getStringInputRole(input.role);
    const value = overrides[input.id] ?? input.sampleValue ?? '';
    const list = acc[role] ?? [];
    list.push(value);
    acc[role] = list;
    return acc;
  }, {});
};

const getOptionFallbackForRole = (role: StringNodeInputRole, options?: StringNodeData['options']): string | undefined => {
  if (!options) {
    return undefined;
  }
  switch (role) {
    case 'delimiter':
      return options.delimiter;
    case 'search':
      return options.search;
    case 'replace':
      return options.replace;
    case 'start':
      return options.start !== undefined ? String(options.start) : undefined;
    case 'end':
      return options.end !== undefined ? String(options.end) : undefined;
    default:
      return undefined;
  }
};

const getRoleValue = (
  buckets: StringRoleBuckets,
  role: StringNodeInputRole,
  options?: StringNodeData['options']
): string | undefined => {
  const list = buckets[role];
  if (list && list.length) {
    const value = list[0];
    return value === undefined || value === null ? undefined : value;
  }
  return getOptionFallbackForRole(role, options);
};

const getNumericRoleValue = (
  buckets: StringRoleBuckets,
  role: StringNodeInputRole,
  fallback: number
): number => {
  const rawValue = getRoleValue(buckets, role, undefined);
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const evaluateStringPreview = (
  data: StringNodeData,
  overrides: StringInputOverrides = {}
): NodePreview<string | number> => {
  const buckets = bucketizeStringInputs(data, overrides);
  const textValues = buckets.text ?? [];
  const primary = textValues[0] ?? '';

  try {
    logicLogger.debug('Evaluating string preview', {
      operation: data.operation,
      overrideCount: Object.keys(overrides).length,
      textInputs: textValues.length
    });
    switch (data.operation) {
      case 'concat': {
        const delimiter = getRoleValue(buckets, 'delimiter', data.options) ?? '';
        const concatenated = textValues.filter((value) => value !== '').join(delimiter);
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
        const start = getNumericRoleValue(buckets, 'start', data.options?.start ?? 0);
        const endValue = getRoleValue(buckets, 'end', data.options);
        const parsedEnd = endValue === undefined ? undefined : Number(endValue);
        const end = endValue === undefined ? primary.length : Number.isFinite(parsedEnd) ? parsedEnd : primary.length;
        const result = primary.slice(start, end);
        return { state: 'ready', heading: 'Slice', summary: result, value: result };
      }
      case 'replace': {
        const search = getRoleValue(buckets, 'search', data.options) ?? '';
        const replace = getRoleValue(buckets, 'replace', data.options) ?? '';
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

export interface ListInputOverrides {
  nodeId?: string;
  primarySample?: ScalarValue[];
  secondarySample?: ScalarValue[];
  start?: number | null;
  end?: number | null;
  order?: 'asc' | 'desc';
  callbackRef?: FunctionReferenceValue;
  initialValue?: ScalarValue;
}

export interface ListCallbackInvocation {
  reference: FunctionReferenceValue;
  args: ScalarValue[];
  metadata: {
    operation: ListNodeData['operation'];
    phase: 'map' | 'filter' | 'reduce' | 'sort-comparator';
    index: number;
  };
}

export interface ListEvaluationHooks {
  invokeCallback?: (invocation: ListCallbackInvocation) => ScalarValue | undefined;
}

const resolveIndex = (value: number | null | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const clampIndex = (value: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const compareSortValues = (left: ScalarValue | undefined, right: ScalarValue | undefined): number => {
  if (left === right) {
    return 0;
  }
  if (left === null || typeof left === 'undefined') {
    return -1;
  }
  if (right === null || typeof right === 'undefined') {
    return 1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left as ScalarValue).localeCompare(String(right as ScalarValue));
};

export const evaluateListPreview = (
  data: ListNodeData,
  overrides: ListInputOverrides = {},
  hooks: ListEvaluationHooks = {}
): NodePreview<ScalarValue[] | number | ScalarValue> => {
  const primary = overrides.primarySample ?? data.primarySample ?? [];
  const secondary = overrides.secondarySample ?? data.secondarySample ?? [];
  const order = overrides.order ?? data.sort ?? 'asc';
  const callbackRef = overrides.callbackRef;
  const invokeCallback = hooks.invokeCallback;
  const nodeId = overrides.nodeId ?? 'list-node';

  const callbackUnavailable = (
    heading: string,
    summary: string
  ): NodePreview<ScalarValue[] | number | ScalarValue> => ({
    state: 'unknown',
    heading,
    summary
  });

  const executeCallback = (
    phase: ListCallbackInvocation['metadata']['phase'],
    index: number,
    args: ScalarValue[]
  ): ScalarValue | undefined => {
    if (!callbackRef || !invokeCallback) {
      return undefined;
    }
    try {
      return invokeCallback({
        reference: callbackRef,
        args,
        metadata: {
          operation: data.operation,
          phase,
          index
        }
      });
    } catch (error) {
      logicLogger.error('Callback execution failed', {
        nodeId,
        operation: data.operation,
        phase,
        index,
        message: (error as Error).message
      });
      return undefined;
    }
  };

  try {
    switch (data.operation) {
      case 'append': {
        const appended = primary.concat(secondary);
        return { state: 'ready', heading: 'Append', summary: formatScalar(appended), value: appended };
      }
      case 'merge': {
        const merged = primary.concat(secondary);
        return { state: 'ready', heading: 'Merge', summary: formatScalar(merged), value: merged };
      }
      case 'slice': {
        const startIndex = clampIndex(resolveIndex(overrides.start ?? data.startSample, 0), primary.length);
        const endFallback = overrides.end ?? data.endSample ?? primary.length;
        const endIndex = clampIndex(resolveIndex(endFallback, primary.length), primary.length);
        const normalizedEnd = Math.max(endIndex, startIndex);
        const sliced = primary.slice(startIndex, normalizedEnd);
        return { state: 'ready', heading: 'Slice', summary: formatScalar(sliced), value: sliced };
      }
      case 'unique': {
        const unique = Array.from(new Set(primary));
        return { state: 'ready', heading: 'Unique', summary: formatScalar(unique), value: unique };
      }
      case 'map': {
        if (!callbackRef || !invokeCallback) {
          logicLogger.warn('Map preview skipped due to missing callback', { nodeId, operation: data.operation });
          return callbackUnavailable('Callback required', 'Connect a function reference to map list items.');
        }
        const mapped = primary.map((item, index) => {
          const result = executeCallback('map', index, [item, index]);
          if (!isScalarValue(result)) {
            logicLogger.warn('Map callback returned invalid value', { nodeId, index, operation: data.operation });
            return null;
          }
          return result as ScalarValue;
        });
        return { state: 'ready', heading: 'Mapped', summary: formatScalar(mapped), value: mapped };
      }
      case 'filter': {
        if (!callbackRef || !invokeCallback) {
          logicLogger.warn('Filter preview skipped due to missing callback', { nodeId, operation: data.operation });
          return callbackUnavailable('Callback required', 'Connect a function reference to filter list items.');
        }
        const filtered = primary.filter((item, index) => {
          const result = executeCallback('filter', index, [item, index]);
          const keep = Boolean(result);
          logicLogger.debug('Filter callback evaluated', { nodeId, index, keep, operation: data.operation });
          return keep;
        });
        return { state: 'ready', heading: 'Filtered', summary: formatScalar(filtered), value: filtered };
      }
      case 'reduce': {
        if (!callbackRef || !invokeCallback) {
          logicLogger.warn('Reduce preview skipped due to missing callback', { nodeId, operation: data.operation });
          return callbackUnavailable('Callback required', 'Connect a reducer function reference.');
        }
        const initialProvided = overrides.initialValue ?? data.reducerInitialSample;
        if (typeof initialProvided === 'undefined') {
          logicLogger.warn('Reduce preview missing initial value', { nodeId, operation: data.operation });
          return {
            state: 'unknown',
            heading: 'Initial value required',
            summary: 'Provide an initial value sample or bind one.'
          };
        }
        let accumulator = initialProvided as ScalarValue;
        primary.forEach((item, index) => {
          const result = executeCallback('reduce', index, [accumulator, item, index]);
          if (isScalarValue(result)) {
            accumulator = result as ScalarValue;
          } else {
            logicLogger.warn('Reducer callback returned invalid value', { nodeId, index, operation: data.operation });
          }
        });
        return { state: 'ready', heading: 'Reduce', summary: formatScalar(accumulator), value: accumulator };
      }
      case 'sort': {
        let comparatorCalls = 0;
        const indexed = primary.map((value, index) => ({ value, index }));
        const sortedEntries = indexed.sort((left, right) => {
          if (callbackRef && invokeCallback) {
            const result = executeCallback('sort-comparator', comparatorCalls, [left.value as ScalarValue, right.value as ScalarValue]);
            comparatorCalls += 1;
            if (typeof result === 'number' && Number.isFinite(result)) {
              const normalized = order === 'desc' ? result * -1 : result;
              if (normalized === 0) {
                const valueFallback = compareSortValues(left.value as ScalarValue, right.value as ScalarValue);
                if (valueFallback !== 0) {
                  const resolved = order === 'desc' ? valueFallback * -1 : valueFallback;
                  logicLogger.debug('Sort comparator tie resolved via value comparison', {
                    nodeId,
                    call: comparatorCalls,
                    comparatorResult: result,
                    valueFallback,
                    resolved
                  });
                  return resolved;
                }
                const stable = left.index - right.index;
                if (stable !== 0) {
                  logicLogger.debug('Sort comparator tie resolved via stable ordering', {
                    nodeId,
                    call: comparatorCalls,
                    comparatorResult: result,
                    leftIndex: left.index,
                    rightIndex: right.index
                  });
                  return stable;
                }
              } else {
                logicLogger.debug('Sort comparator value applied', {
                  nodeId,
                  call: comparatorCalls,
                  comparatorResult: result,
                  normalizedResult: normalized
                });
                return normalized;
              }
            } else {
              logicLogger.warn('Invalid sort comparator result, falling back to default comparison', {
                nodeId,
                result,
                call: comparatorCalls
              });
            }
          }
          const fallback = compareSortValues(left.value as ScalarValue, right.value as ScalarValue);
          if (fallback !== 0) {
            return order === 'desc' ? fallback * -1 : fallback;
          }
          return left.index - right.index;
        });
        const sorted = sortedEntries.map((entry) => entry.value as ScalarValue);
        return { state: 'ready', heading: 'Sorted', summary: formatScalar(sorted), value: sorted };
      }
      case 'length': {
        return { state: 'ready', heading: 'Length', summary: `${primary.length}`, value: primary.length };
      }
      default:
        return { state: 'unknown', heading: 'No preview', summary: 'Operation not recognized.' };
    }
  } catch (error) {
    logicLogger.error('Failed to generate list preview', {
      error: (error as Error).message,
      nodeId,
      operation: data.operation
    });
    return { state: 'error', heading: 'Error', summary: 'Unable to evaluate list operation.' };
  }
};

export interface RelationalInputOverrides {
  left?: ScalarValue;
  right?: ScalarValue;
}

export const evaluateRelationalPreview = (
  data: RelationalOperatorNodeData,
  overrides: RelationalInputOverrides = {}
): NodePreview<boolean> => {
  const left = overrides.left ?? data.leftSample;
  const right = overrides.right ?? data.rightSample;

  if (left === undefined || right === undefined) {
    return {
      state: 'unknown',
      heading: 'Awaiting operands',
      summary: 'Connect both operands or enter sample values.'
    };
  }

  const leftNumber = coerceNumberValue(left);
  const rightNumber = coerceNumberValue(right);

  let result = false;
  if (leftNumber !== undefined && rightNumber !== undefined) {
    switch (data.operation) {
      case 'gt':
        result = leftNumber > rightNumber;
        break;
      case 'gte':
        result = leftNumber >= rightNumber;
        break;
      case 'lt':
        result = leftNumber < rightNumber;
        break;
      case 'lte':
        result = leftNumber <= rightNumber;
        break;
      case 'eq':
        result = leftNumber === rightNumber;
        break;
      case 'neq':
        result = leftNumber !== rightNumber;
        break;
      default:
        result = false;
    }
  } else if (data.operation === 'eq' || data.operation === 'neq') {
    const equality = areScalarValuesEqual(left as ScalarValue, right as ScalarValue);
    result = data.operation === 'eq' ? equality : !equality;
  } else {
    const leftString = formatScalar(left as ScalarValue);
    const rightString = formatScalar(right as ScalarValue);
    switch (data.operation) {
      case 'gt':
        result = leftString > rightString;
        break;
      case 'gte':
        result = leftString >= rightString;
        break;
      case 'lt':
        result = leftString < rightString;
        break;
      case 'lte':
        result = leftString <= rightString;
        break;
      default:
        result = false;
    }
  }

  return {
    state: 'ready',
    heading: data.operation.toUpperCase(),
    summary: result.toString(),
    value: result
  };
};

const resolvePath = (source: Record<string, ScalarValue>, path?: string): ScalarValue | undefined => {
  if (!path) {
    return undefined;
  }
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) {
    return undefined;
  }
  let current: ScalarValue | Record<string, ScalarValue> | undefined = source;
  for (const segment of segments) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, ScalarValue>)[segment];
    } else {
      return undefined;
    }
  }
  return current as ScalarValue | undefined;
};

const assignPath = (source: Record<string, ScalarValue>, path: string, value: ScalarValue): Record<string, ScalarValue> => {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) {
    return source;
  }
  const clone = JSON.parse(JSON.stringify(source)) as Record<string, ScalarValue>;
  let cursor: Record<string, ScalarValue> = clone;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const existing = cursor[segment];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, ScalarValue>;
  }
  cursor[segments[segments.length - 1]] = value;
  return clone;
};

export interface ObjectInputOverrides {
  sourceSample?: Record<string, ScalarValue>;
  patchSample?: Record<string, ScalarValue>;
  selectedKeys?: string[];
  path?: string;
  valueSample?: ScalarValue;
}

export const evaluateObjectPreview = (
  data: ObjectNodeData,
  overrides: ObjectInputOverrides = {}
): NodePreview => {
  const source = overrides.sourceSample ?? data.sourceSample ?? {};
  const patch = overrides.patchSample ?? data.patchSample ?? {};
  const selectedKeys = overrides.selectedKeys ?? data.selectedKeys ?? [];
  const path = overrides.path ?? data.path;
  const valueSample = overrides.valueSample ?? data.valueSample ?? null;

  try {
    switch (data.operation) {
      case 'merge': {
        const merged = { ...source, ...patch };
        return { state: 'ready', heading: 'Merged', summary: formatScalar(merged), value: merged };
      }
      case 'pick': {
        const picked = selectedKeys.reduce<Record<string, ScalarValue>>((acc, key) => {
          if (key in source) {
            acc[key] = source[key];
          }
          return acc;
        }, {});
        return { state: 'ready', heading: 'Picked', summary: formatScalar(picked), value: picked };
      }
      case 'set': {
        if (!path) {
          return { state: 'unknown', heading: 'Awaiting Path', summary: 'Provide a key to preview the result.' };
        }
        const valueToAssign = (valueSample ?? null) as ScalarValue;
        const next = assignPath(source, path, valueToAssign);
        return { state: 'ready', heading: 'Set', summary: formatScalar(next), value: next };
      }
      case 'get': {
        if (!path) {
          return { state: 'unknown', heading: 'Awaiting Path', summary: 'Provide a key to preview the result.' };
        }
        const resolved = resolvePath(source, path);
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

import { useMemo } from 'react';
import { ScalarSampleKind, ScalarValue } from '@buildweaver/libs';
import { ObjectAttributesEditor } from './ObjectAttributesEditor';
import { parseScalarList, stringifyScalarList } from './valueParsers';
import { useTextDraft } from './hooks/useTextDraft';
import { logicLogger } from '../../lib/logger';

export type ScalarValueKind = ScalarSampleKind;

interface ScalarValueInputProps {
  nodeId: string;
  fieldKey: string;
  valueKind: ScalarValueKind;
  value?: ScalarValue;
  onValueKindChange: (next: ScalarValueKind) => void;
  onValueChange: (next: ScalarValue) => void;
  onValueKindCommit?: (next: { kind: ScalarValueKind; value: ScalarValue }) => void;
}

const DEFAULT_VALUES: Record<ScalarValueKind, ScalarValue> = {
  string: '',
  number: 0,
  boolean: false,
  list: [],
  object: {}
};

const coerceValue = (value: ScalarValue | undefined, kind: ScalarValueKind): ScalarValue => {
  if (value === undefined || value === null) {
    return DEFAULT_VALUES[kind];
  }
  switch (kind) {
    case 'string':
      return typeof value === 'string' ? value : String(value);
    case 'number':
      return typeof value === 'number' ? value : Number(value) || 0;
    case 'boolean':
      return typeof value === 'boolean' ? value : Boolean(value);
    case 'list':
      return Array.isArray(value) ? (value as ScalarValue[]) : [];
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, ScalarValue>)
        : {};
    default:
      return value;
  }
};

const ensureScalarClone = (value: ScalarValue): ScalarValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => ensureScalarClone(entry as ScalarValue));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, ScalarValue>>((acc, [key, val]) => {
      acc[key] = ensureScalarClone(val as ScalarValue);
      return acc;
    }, {});
  }
  return value;
};

export const ScalarValueInput = ({
  nodeId,
  fieldKey,
  valueKind,
  value,
  onValueKindChange,
  onValueChange,
  onValueKindCommit
}: ScalarValueInputProps) => {
  const normalizedKind = valueKind ?? 'string';
  const coercedValue = useMemo(() => coerceValue(value, normalizedKind), [value, normalizedKind]);
  const listSampleString = useMemo(() => {
    if (normalizedKind !== 'list') {
      return '';
    }
    const listValue = Array.isArray(coercedValue) ? (coercedValue as ScalarValue[]) : [];
    return stringifyScalarList(listValue);
  }, [coercedValue, normalizedKind]);

  const numberSampleString = useMemo(() => {
    if (normalizedKind !== 'number') {
      return '';
    }
    return typeof coercedValue === 'number' && Number.isFinite(coercedValue)
      ? String(coercedValue)
      : '';
  }, [coercedValue, normalizedKind]);

  const [listDraft, setListDraft] = useTextDraft(listSampleString, {
    nodeId,
    field: `${fieldKey}.list` as const
  });

  const [numberDraft, setNumberDraft] = useTextDraft(
    numberSampleString,
    {
      nodeId,
      field: `${fieldKey}.number` as const
    },
    { preserveLocalEdits: true }
  );

  const handleTypeChange = (nextKind: ScalarValueKind) => {
    if (nextKind === normalizedKind) {
      return;
    }
    logicLogger.info('Scalar value kind changed', { nodeId, fieldKey, kind: nextKind });
    const nextValue = ensureScalarClone(DEFAULT_VALUES[nextKind]);
    if (onValueKindCommit) {
      onValueKindCommit({ kind: nextKind, value: nextValue });
      return;
    }
    onValueKindChange(nextKind);
    onValueChange(nextValue);
  };

  const handleStringChange = (next: string) => {
    logicLogger.debug('Scalar string updated', { nodeId, fieldKey, length: next.length });
    onValueChange(next);
  };

  const handleNumberChange = (next: string) => {
    setNumberDraft(next);
    const parsed = next === '' ? null : Number(next);
    const resolved = parsed === null || Number.isNaN(parsed) ? null : parsed;
    logicLogger.debug('Scalar number updated', { nodeId, fieldKey, value: resolved });
    onValueChange((resolved ?? 0) as ScalarValue);
  };

  const handleBooleanChange = (next: string) => {
    const boolValue = next === 'true';
    logicLogger.debug('Scalar boolean updated', { nodeId, fieldKey, value: boolValue });
    onValueChange(boolValue);
  };

  const handleListChange = (next: string) => {
    setListDraft(next);
    const entries = parseScalarList(next);
    logicLogger.debug('Scalar list updated', { nodeId, fieldKey, size: entries.length });
    onValueChange(entries);
  };

  const renderValueField = () => {
    switch (normalizedKind) {
      case 'number':
        return (
          <input
            aria-label="Numeric value"
            type="text"
            inputMode="decimal"
            step="any"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={numberDraft}
            onChange={(event) => handleNumberChange(event.target.value)}
          />
        );
      case 'boolean':
        return (
          <select
            aria-label="Boolean value"
            className="bw-node-select w-full text-xs"
            value={coercedValue ? 'true' : 'false'}
            onChange={(event) => handleBooleanChange(event.target.value)}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'list':
        return (
          <textarea
            aria-label="List value"
            rows={3}
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={listDraft}
            onChange={(event) => handleListChange(event.target.value)}
          />
        );
      case 'object':
        return (
          <ObjectAttributesEditor
            nodeId={nodeId}
            fieldKey={`${fieldKey}.object`}
            value={(coercedValue as Record<string, ScalarValue>) ?? {}}
            onChange={(next) => {
              logicLogger.debug('Scalar object updated', { nodeId, fieldKey, keys: Object.keys(next).length });
              onValueChange(next);
            }}
            emptyHint="Add nested properties"
          />
        );
      case 'string':
      default:
        return (
          <input
            aria-label="String value"
            type="text"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={typeof coercedValue === 'string' ? coercedValue : ''}
            onChange={(event) => handleStringChange(event.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col flex-wrap gap-2 md:flex-nowrap">
        <div className="min-w-full max-w-full flex-1 md:w-44 md:flex-initial">
          <select
            aria-label="Value type"
            className="bw-node-select w-full text-xs"
            value={normalizedKind}
            onChange={(event) => handleTypeChange(event.target.value as ScalarValueKind)}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="list">List</option>
            <option value="object">Object</option>
          </select>
        </div>
        <div className="flex-1 min-w-full max-w-full">{renderValueField()}</div>
      </div>
    </div>
  );
};

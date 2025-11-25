import { useCallback, useEffect, useRef, useState } from 'react';
import { ScalarValue } from '@buildweaver/libs';
import { parseScalarList, stringifyScalarList } from './valueParsers';
import { logicLogger } from '../../lib/logger';

export type AttributeValueType = 'string' | 'number' | 'boolean' | 'list' | 'object';

interface AttributeDraft {
  id: string;
  key: string;
  type: AttributeValueType;
  raw: string;
  booleanValue: boolean;
  objectValue: Record<string, ScalarValue>;
}

interface ObjectAttributesEditorProps {
  nodeId: string;
  fieldKey: string;
  value?: Record<string, ScalarValue>;
  onChange: (next: Record<string, ScalarValue>) => void;
  emptyHint?: string;
}

const ATTRIBUTE_TYPE_OPTIONS: { label: string; value: AttributeValueType }[] = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'List', value: 'list' },
  { label: 'Object', value: 'object' }
];

const generateAttributeId = () => `attr-${Math.random().toString(36).slice(2, 10)}`;

const toDraftType = (value: ScalarValue | undefined): AttributeValueType => {
  if (Array.isArray(value)) {
    return 'list';
  }
  if (value && typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  return 'string';
};

const toAttributeDrafts = (input?: Record<string, ScalarValue>): AttributeDraft[] => {
  if (!input) {
    return [];
  }
  return Object.entries(input).map(([key, rawValue]) => {
    const type = toDraftType(rawValue);
    const normalizedRaw = (() => {
      if (type === 'list' && Array.isArray(rawValue)) {
        return stringifyScalarList(rawValue as ScalarValue[]);
      }
      if (type === 'number' && typeof rawValue === 'number') {
        return rawValue.toString();
      }
      if (type === 'string' && typeof rawValue === 'string') {
        return rawValue;
      }
      return rawValue === null || rawValue === undefined ? '' : String(rawValue);
    })();
    return {
      id: generateAttributeId(),
      key,
      type,
      raw: normalizedRaw,
      booleanValue: type === 'boolean' ? Boolean(rawValue) : false,
      objectValue:
        type === 'object' && rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
          ? (rawValue as Record<string, ScalarValue>)
          : {}
    };
  });
};

const toRecord = (attributes: AttributeDraft[], nodeId: string, fieldKey: string): Record<string, ScalarValue> => {
  return attributes.reduce<Record<string, ScalarValue>>((acc, attribute) => {
    const normalizedKey = attribute.key.trim();
    if (!normalizedKey) {
      return acc;
    }
    switch (attribute.type) {
      case 'string':
        acc[normalizedKey] = attribute.raw ?? '';
        break;
      case 'number': {
        const numeric = Number(attribute.raw);
        if (Number.isFinite(numeric)) {
          acc[normalizedKey] = numeric;
        } else {
          acc[normalizedKey] = null;
          logicLogger.warn('Invalid numeric attribute coerced to null', {
            nodeId,
            fieldKey,
            attributeId: attribute.id,
            key: normalizedKey,
            raw: attribute.raw
          });
        }
        break;
      }
      case 'boolean':
        acc[normalizedKey] = attribute.booleanValue;
        break;
      case 'list':
        acc[normalizedKey] = parseScalarList(attribute.raw);
        break;
      case 'object':
        acc[normalizedKey] = attribute.objectValue ?? {};
        break;
      default:
        acc[normalizedKey] = attribute.raw ?? '';
    }
    return acc;
  }, {});
};

export const ObjectAttributesEditor = ({
  nodeId,
  fieldKey,
  value,
  onChange,
  emptyHint = 'No attributes yet. Add one to get started.'
}: ObjectAttributesEditorProps) => {
  const [attributes, setAttributes] = useState<AttributeDraft[]>(() => toDraftsWithFallback(value));
  const lastValueRef = useRef<Record<string, ScalarValue> | undefined>(value);

  function toDraftsWithFallback(input?: Record<string, ScalarValue>): AttributeDraft[] {
    const drafts = toAttributeDrafts(input);
    if (drafts.length) {
      return drafts;
    }
    return [];
  }

  useEffect(() => {
    if (value === lastValueRef.current) {
      return;
    }
    lastValueRef.current = value;
    setAttributes(toDraftsWithFallback(value));
  }, [value]);

  const emitChange = useCallback(
    (nextAttributes: AttributeDraft[], reason: string, metadata?: Record<string, unknown>) => {
      setAttributes(nextAttributes);
      const record = toRecord(nextAttributes, nodeId, fieldKey);
      lastValueRef.current = record;
      logicLogger.debug('Object attributes updated', {
        nodeId,
        fieldKey,
        reason,
        keys: Object.keys(record).length,
        ...metadata
      });
      onChange(record);
    },
    [fieldKey, nodeId, onChange]
  );

  const handleAttributePatch = useCallback(
    (attributeId: string, patch: Partial<AttributeDraft>, reason: string) => {
      emitChange(
        attributes.map((attribute) => (attribute.id === attributeId ? { ...attribute, ...patch } : attribute)),
        reason,
        { attributeId }
      );
    },
    [attributes, emitChange]
  );

  const handleAddAttribute = () => {
    const id = generateAttributeId();
    emitChange(
      attributes.concat({
        id,
        key: '',
        type: 'string',
        raw: '',
        booleanValue: false,
        objectValue: {}
      }),
      'attribute.add',
      { attributeId: id }
    );
  };

  const handleRemoveAttribute = (attributeId: string) => {
    emitChange(
      attributes.filter((attribute) => attribute.id !== attributeId),
      'attribute.remove',
      { attributeId }
    );
  };

  const renderValueField = (attribute: AttributeDraft) => {
    switch (attribute.type) {
      case 'boolean':
        return (
          <select
            aria-label="Attribute boolean value"
            className="bw-node-select w-full text-xs"
            value={attribute.booleanValue ? 'true' : 'false'}
            onChange={(event) =>
              handleAttributePatch(attribute.id, { booleanValue: event.target.value === 'true' }, 'attribute.boolean')
            }
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'list':
        return (
          <textarea
            aria-label="Attribute list value"
            rows={3}
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={attribute.raw}
            onChange={(event) => handleAttributePatch(attribute.id, { raw: event.target.value }, 'attribute.list')}
          />
        );
      case 'object':
        return (
          <div className="w-full min-w-0 rounded-xl border border-white/10 bg-bw-ink/40 px-3 py-2 text-xs text-bw-platinum">
            Nested object
          </div>
        );
      case 'number':
        return (
          <input
            aria-label="Attribute numeric value"
            type="number"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={attribute.raw}
            onChange={(event) => handleAttributePatch(attribute.id, { raw: event.target.value }, 'attribute.number')}
          />
        );
      case 'string':
      default:
        return (
          <input
            aria-label="Attribute string value"
            type="text"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={attribute.raw}
            onChange={(event) => handleAttributePatch(attribute.id, { raw: event.target.value }, 'attribute.string')}
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      {attributes.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-2 text-xs text-bw-platinum/70">
          {emptyHint}
        </p>
      )}
      {attributes.map((attribute) => (
        <div key={attribute.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div data-testid="attribute-row" className="flex flex-col flex-wrap gap-2 md:flex-nowrap">
            <div className="flex-1 min-w-full max-w-full">
              <input
                aria-label="Attribute key"
                type="text"
                className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Attribute key"
                value={attribute.key}
                onChange={(event) => handleAttributePatch(attribute.id, { key: event.target.value }, 'attribute.key')}
              />
            </div>
            <div className="w-full min-w-full max-w-full flex-none md:w-40 lg:w-48">
              <select
                aria-label="Attribute type"
                className="bw-node-select w-full text-xs"
                value={attribute.type}
                onChange={(event) => {
                  const nextType = event.target.value as AttributeValueType;
                  handleAttributePatch(
                    attribute.id,
                    {
                      type: nextType,
                      raw: '',
                      booleanValue: false,
                      objectValue: nextType === 'object' ? attribute.objectValue ?? {} : {}
                    },
                    'attribute.type'
                  );
                }}
              >
                {ATTRIBUTE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-full max-w-full">{renderValueField(attribute)}</div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs uppercase tracking-[0.2em] text-bw-amber"
              onClick={() => handleRemoveAttribute(attribute.id)}
            >
              Remove
            </button>
          </div>
          {attribute.type === 'object' && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-bw-ink/40 p-3">
              <ObjectAttributesEditor
                nodeId={nodeId}
                fieldKey={`${fieldKey}.${attribute.key || attribute.id}`}
                value={attribute.objectValue}
                onChange={(nested) =>
                  handleAttributePatch(attribute.id, { objectValue: nested }, 'attribute.nested')
                }
                emptyHint="Add nested attribute"
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="w-full rounded-2xl border border-dashed border-white/20 py-2 text-xs uppercase tracking-[0.2em] text-white/70"
        onClick={handleAddAttribute}
      >
        Add attribute
      </button>
    </div>
  );
};

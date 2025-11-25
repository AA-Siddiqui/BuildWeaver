import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ObjectNodeData, ScalarValue } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { useCursorRestorer } from './hooks/useCursorRestorer';
import { logicLogger } from '../../lib/logger';
import { ConnectedBinding, usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';
import { ObjectAttributesEditor } from './ObjectAttributesEditor';
import { ScalarValueInput, ScalarValueKind } from './ScalarValueInput';
import {
  ObjectInputDefinition,
  ObjectInputRole,
  getObjectHandleId,
  getObjectOperationInputs
} from './objectOperationConfig';
import { useTextDraft } from './hooks/useTextDraft';

const inferValueSampleKind = (value: ScalarValue | undefined): ObjectNodeData['valueSampleKind'] => {
  if (Array.isArray(value)) {
    return 'list';
  }
  if (value && typeof value === 'object') {
    return 'object';
  }
  const primitiveType = typeof value;
  if (primitiveType === 'number') {
    return 'number';
  }
  if (primitiveType === 'boolean') {
    return 'boolean';
  }
  return 'string';
};

export const ObjectNode = ({ id, data }: NodeProps<ObjectNodeData>) => {
  const updateData = useNodeDataUpdater<ObjectNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const inputDefinitions = useMemo(() => getObjectOperationInputs(data.operation), [data.operation]);
  const bindings = useMemo<Partial<Record<ObjectInputRole, ConnectedBinding | undefined>>>(
    () => {
      const entries = inputDefinitions.map((definition) => {
        const handleId = getObjectHandleId(id, definition.role);
        return [definition.role, previewResolver.getHandleBinding(id, handleId)];
      });
      return Object.fromEntries(entries) as Partial<Record<ObjectInputRole, ConnectedBinding | undefined>>;
    },
    [id, inputDefinitions, previewResolver]
  );
  const selectedKeysValue = useMemo(() => (data.selectedKeys ?? []).join('\n'), [data.selectedKeys]);
  const [keysDraft, setKeysDraft] = useTextDraft(selectedKeysValue, { nodeId: id, field: 'selectedKeys' }, {
    preserveLocalEdits: true
  });
  const initialSampleKind = data.valueSampleKind ?? inferValueSampleKind(data.valueSample) ?? 'string';
  const [valueSampleKindState, setValueSampleKindState] = useState<ObjectNodeData['valueSampleKind']>(initialSampleKind);
  const valueSampleKindRef = useRef<ObjectNodeData['valueSampleKind']>(initialSampleKind);

  useEffect(() => {
    const inferredKind =
      data.valueSampleKind ??
      (data.valueSample !== undefined && data.valueSample !== null ? inferValueSampleKind(data.valueSample) : undefined);

    if (!inferredKind) {
      return;
    }

    if (valueSampleKindRef.current !== inferredKind) {
      logicLogger.debug('Object value sample kind synced from data', { nodeId: id, valueSampleKind: inferredKind });
      valueSampleKindRef.current = inferredKind;
    }

    setValueSampleKindState((current) => (current === inferredKind ? current : inferredKind));
  }, [data.valueSample, data.valueSampleKind, id]);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as ObjectNodeData['operation'];
    logicLogger.info('Object operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleObjectSampleChange = (key: 'sourceSample' | 'patchSample', value: Record<string, ScalarValue>) => {
    logicLogger.debug('Object sample updated', {
      nodeId: id,
      key,
      size: Object.keys(value).length
    });
    updateData((prev) => ({ ...prev, [key]: value }));
  };

  const handlePathChange = (event: ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value;
    logicLogger.debug('Object path updated', { nodeId: id, path });
    updateData((prev) => ({ ...prev, path }));
    restoreCursor(event.target, { nodeId: id, field: 'path' });
  };

  const handleSelectedKeysChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextDraft = event.target.value;
    setKeysDraft(nextDraft);
    const keys = nextDraft
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    logicLogger.debug('Object keys draft updated', {
      nodeId: id,
      keysCount: keys.length,
      rawLength: nextDraft.length
    });
    updateData((prev) => ({ ...prev, selectedKeys: keys }));
    restoreCursor(event.target, { nodeId: id, field: 'selectedKeys' });
  };

  const handleValueSampleKindChange = (valueSampleKind: ObjectNodeData['valueSampleKind'] = 'string') => {
    logicLogger.info('Object value sample kind changed', {
      nodeId: id,
      valueSampleKind,
      previous: valueSampleKindRef.current
    });
    valueSampleKindRef.current = valueSampleKind;
    setValueSampleKindState(valueSampleKind);
    updateData((prev) => ({ ...prev, valueSampleKind }));
  };

  const handleValueSampleChange = (valueSample: ScalarValue) => {
    const lockedKind =
      valueSampleKindRef.current ??
      valueSampleKindState ??
      inferValueSampleKind(valueSample) ??
      'string';
    logicLogger.debug('Object value sample updated', {
      nodeId: id,
      type: Array.isArray(valueSample) ? 'list' : typeof valueSample,
      keys: valueSample && typeof valueSample === 'object' && !Array.isArray(valueSample)
        ? Object.keys(valueSample as Record<string, ScalarValue>).length
        : undefined,
      valueSampleKind: lockedKind
    });
    updateData((prev) => ({ ...prev, valueSample, valueSampleKind: lockedKind }));
  };

  const renderBinding = (binding?: ConnectedBinding) => {
    if (!binding) {
      return null;
    }
    return (
      <div className="mt-2 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
        <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
        <p className="text-white">{formatScalar(binding.value as ScalarValue | Record<string, ScalarValue>)}</p>
        <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
      </div>
    );
  };

  const renderInputEditor = (definition: ObjectInputDefinition) => {
    switch (definition.kind) {
      case 'object': {
        const sampleKey = definition.role === 'source' ? 'sourceSample' : 'patchSample';
        const sampleValue = (data[sampleKey] as Record<string, ScalarValue>) ?? {};
        return (
          <ObjectAttributesEditor
            nodeId={id}
            fieldKey={`object.${definition.role}`}
            value={sampleValue}
            onChange={(next) => handleObjectSampleChange(sampleKey as 'sourceSample' | 'patchSample', next)}
            emptyHint={definition.role === 'source' ? 'Describe your base object' : 'Describe fields to merge'}
          />
        );
      }
      case 'keys':
        return (
          <textarea
            rows={3}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={keysDraft}
            onChange={handleSelectedKeysChange}
            placeholder="Enter one key per line"
          />
        );
      case 'key':
        return (
          <input
            type="text"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={data.path ?? ''}
            onChange={handlePathChange}
            placeholder="e.g. profile.address.city"
          />
        );
      case 'value': {
        const effectiveValueKind = (valueSampleKindState ?? 'string') as ScalarValueKind;
        return (
          <ScalarValueInput
            nodeId={id}
            fieldKey="object.valueSample"
            valueKind={effectiveValueKind}
            value={data.valueSample}
            onValueKindChange={handleValueSampleKindChange}
            onValueChange={handleValueSampleChange}
          />
        );
      }
      default:
        return null;
    }
  };

  const renderInputSection = (definition: ObjectInputDefinition) => {
    const handleId = getObjectHandleId(id, definition.role);
    const binding = bindings[definition.role];
    return (
      <div key={definition.role} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <Handle
          type="target"
          id={handleId}
          position={Position.Left}
          className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
        />
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">{definition.label}</p>
          <p className="text-[10px] text-bw-platinum/50">{definition.description}</p>
        </div>
        {renderBinding(binding)}
        {!binding && <div className="mt-2">{renderInputEditor(definition)}</div>}
      </div>
    );
  };

  return (
    <div className="relative">
      <NodeChrome badge="Object" label={data.label} description={data.description ?? 'Object utilities'} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select
            className="bw-node-select mt-1 text-xs"
            value={data.operation}
            onChange={handleOperationChange}
          >
            <option value="merge">Merge</option>
            <option value="pick">Pick</option>
            <option value="set">Set</option>
            <option value="get">Get</option>
            <option value="keys">Keys</option>
            <option value="values">Values</option>
          </select>
        </label>
        <div className="space-y-3">
          {inputDefinitions.map((definition) => renderInputSection(definition))}
        </div>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`object-${id}-out`} />
    </div>
  );
};

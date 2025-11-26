import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ConditionalNodeData, ScalarSampleKind, ScalarValue } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { logicLogger } from '../../lib/logger';
import { ScalarValueInput } from './ScalarValueInput';
import { usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';
import {
  ConditionalInputDefinition,
  getConditionalHandleId,
  getConditionalInputDefinitions
} from './conditionalHandles';

const renderBindingPreview = (binding?: { value: unknown; sourceLabel: string }) => {
  if (!binding) {
    return null;
  }
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
      <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
      <p className="text-white">{formatScalar(binding.value as ScalarValue)}</p>
      <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
    </div>
  );
};

const getValueKind = (kind: ScalarSampleKind | undefined): ScalarSampleKind => kind ?? 'string';

type ValueKey = 'trueValue' | 'falseValue';

type ValueKindKey = `${ValueKey}Kind`;

const VALUE_KIND_KEYS: Record<ValueKey, ValueKindKey> = {
  trueValue: 'trueValueKind',
  falseValue: 'falseValueKind'
};

export const ConditionalNode = ({ id, data }: NodeProps<ConditionalNodeData>) => {
  const updateData = useNodeDataUpdater<ConditionalNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const inputDefinitions = getConditionalInputDefinitions();

  const handleConditionSampleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === 'true';
    logicLogger.debug('Conditional condition sample updated', { nodeId: id, value });
    updateData((prev) => ({ ...prev, conditionSample: value }));
  };

  const handleValueKindChange = (key: ValueKey, kind: ScalarSampleKind) => {
    const field = VALUE_KIND_KEYS[key];
    logicLogger.info('Conditional sample kind changed', { nodeId: id, key, kind });
    updateData((prev) => ({ ...prev, [field]: kind }));
  };

  const handleValueChange = (key: ValueKey, value: ScalarValue) => {
    logicLogger.debug('Conditional sample value updated', {
      nodeId: id,
      key,
      type: Array.isArray(value) ? 'list' : typeof value
    });
    updateData((prev) => ({ ...prev, [key]: value }));
  };

  const renderInputBody = (definition: ConditionalInputDefinition) => {
    const handleId = getConditionalHandleId(id, definition.role);
    const binding = previewResolver.getHandleBinding(id, handleId);
    const renderConditionControl = () => (
      <select
        aria-label="Condition sample"
        className="bw-node-select mt-2 text-xs"
        value={(data.conditionSample ?? false) ? 'true' : 'false'}
        onChange={handleConditionSampleChange}
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );

    const renderValueControl = (key: ValueKey) => (
      <div className="mt-2">
        <ScalarValueInput
          nodeId={id}
          fieldKey={`conditional.${key}`}
          value={data[key]}
          valueKind={getValueKind(data[VALUE_KIND_KEYS[key]])}
          onValueKindChange={(kind) => handleValueKindChange(key, kind)}
          onValueChange={(value) => handleValueChange(key, value)}
        />
      </div>
    );

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
        {renderBindingPreview(binding)}
        {!binding && definition.role === 'condition' && renderConditionControl()}
        {!binding && definition.role === 'truthy' && renderValueControl('trueValue')}
        {!binding && definition.role === 'falsy' && renderValueControl('falseValue')}
      </div>
    );
  };

  return (
    <div className="relative">
      <NodeChrome badge="Conditional" label={data.label} description={data.description ?? 'Branch between values'} preview={preview}>
        <div className="space-y-3">
          {inputDefinitions.map((definition) => renderInputBody(definition))}
        </div>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`conditional-${id}-out`} />
    </div>
  );
};

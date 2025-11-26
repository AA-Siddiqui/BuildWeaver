import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { RelationalOperatorNodeData, ScalarSampleKind, ScalarValue } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { logicLogger } from '../../lib/logger';
import { ScalarValueInput } from './ScalarValueInput';
import { usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';
import {
  RelationalInputRole,
  getRelationalHandleId,
  getRelationalInputLabel,
  getRelationalOperationConfig
} from './relationalOperatorConfig';

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

const ROLE_TO_SAMPLE_KEY: Record<RelationalInputRole, keyof Pick<RelationalOperatorNodeData, 'leftSample' | 'rightSample'>> = {
  left: 'leftSample',
  right: 'rightSample'
};

const ROLE_TO_KIND_KEY: Record<RelationalInputRole, keyof Pick<RelationalOperatorNodeData, 'leftSampleKind' | 'rightSampleKind'>> = {
  left: 'leftSampleKind',
  right: 'rightSampleKind'
};

const ensureKind = (kind?: ScalarSampleKind): ScalarSampleKind => kind ?? 'number';

export const RelationalOperatorNode = ({ id, data }: NodeProps<RelationalOperatorNodeData>) => {
  const updateData = useNodeDataUpdater<RelationalOperatorNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const config = getRelationalOperationConfig(data.operation);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as RelationalOperatorNodeData['operation'];
    logicLogger.info('Relational operator changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleValueKindChange = (role: RelationalInputRole, kind: ScalarSampleKind) => {
    const key = ROLE_TO_KIND_KEY[role];
    logicLogger.info('Relational operand kind changed', { nodeId: id, role, kind });
    updateData((prev) => ({ ...prev, [key]: kind }));
  };

  const handleValueChange = (role: RelationalInputRole, value: ScalarValue) => {
    const key = ROLE_TO_SAMPLE_KEY[role];
    logicLogger.debug('Relational operand sample updated', {
      nodeId: id,
      role,
      type: Array.isArray(value) ? 'list' : typeof value
    });
    updateData((prev) => ({ ...prev, [key]: value }));
  };

  const renderOperand = (role: RelationalInputRole) => {
    const label = getRelationalInputLabel(role);
    const handleId = getRelationalHandleId(id, role);
    const binding = previewResolver.getHandleBinding(id, handleId);
    const sampleKey = ROLE_TO_SAMPLE_KEY[role];
    const kindKey = ROLE_TO_KIND_KEY[role];
    return (
      <div key={role} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <Handle
          type="target"
          id={handleId}
          position={Position.Left}
          className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
        />
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">{label}</p>
          <p className="text-[10px] text-bw-platinum/50">Provide a sample when not connected</p>
        </div>
        {renderBindingPreview(binding)}
        {!binding && (
          <div className="mt-2">
            <ScalarValueInput
              nodeId={id}
              fieldKey={`relational.${role}`}
              value={data[sampleKey]}
              valueKind={ensureKind(data[kindKey])}
              onValueKindChange={(kind) => handleValueKindChange(role, kind)}
              onValueChange={(value) => handleValueChange(role, value)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <NodeChrome badge="Relational" label={data.label} description={data.description ?? config.description} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select className="bw-node-select mt-1 text-xs" value={data.operation} onChange={handleOperationChange}>
            <option value="gt">Greater than</option>
            <option value="gte">Greater than or equal</option>
            <option value="lt">Less than</option>
            <option value="lte">Less than or equal</option>
            <option value="eq">Equals</option>
            <option value="neq">Not equals</option>
          </select>
        </label>
        <div className="space-y-3">
          {(['left', 'right'] as RelationalInputRole[]).map((role) => renderOperand(role))}
        </div>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`relational-${id}-out`} />
    </div>
  );
};

import { ChangeEvent, useEffect } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { LogicalOperatorNodeData } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { logicLogger } from '../../lib/logger';
import { usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';
import {
  LogicalInputRole,
  getLogicalHandleId,
  getLogicalInputLabel,
  getLogicalOperationConfig
} from './logicalOperatorConfig';

const renderBindingPreview = (binding?: { value: unknown; sourceLabel: string }) => {
  if (!binding) {
    return null;
  }
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
      <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
      <p className="text-white">{formatScalar(binding.value as boolean)}</p>
      <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
    </div>
  );
};

const ROLE_TO_KEY: Record<LogicalInputRole, keyof Pick<LogicalOperatorNodeData, 'primarySample' | 'secondarySample'>> = {
  primary: 'primarySample',
  secondary: 'secondarySample'
};

export const LogicalOperatorNode = ({ id, data }: NodeProps<LogicalOperatorNodeData>) => {
  const updateData = useNodeDataUpdater<LogicalOperatorNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const config = getLogicalOperationConfig(data.operation);

  useEffect(() => {
    if (data.operation !== 'not' || data.secondarySample === undefined) {
      return;
    }
    logicLogger.debug('Logical operator secondary sample cleared for NOT', { nodeId: id });
    updateData((prev) => ({ ...prev, secondarySample: undefined }));
  }, [data.operation, data.secondarySample, id, updateData]);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as LogicalOperatorNodeData['operation'];
    logicLogger.info('Logical operator changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleSampleChange = (role: LogicalInputRole, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === 'true';
    const key = ROLE_TO_KEY[role];
    logicLogger.debug('Logical operator sample updated', { nodeId: id, role, value });
    updateData((prev) => ({ ...prev, [key]: value }));
  };

  const renderInput = (role: LogicalInputRole) => {
    const label = getLogicalInputLabel(role);
    const handleId = getLogicalHandleId(id, role);
    const binding = previewResolver.getHandleBinding(id, handleId);
    const key = ROLE_TO_KEY[role];
    const sampleValue = (data[key] ?? false) ? 'true' : 'false';
    return (
      <div key={role} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <Handle
          type="target"
          id={handleId}
          position={Position.Left}
          className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
        />
        <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">{label}</p>
        {renderBindingPreview(binding)}
        {!binding && (
          <select
            aria-label={`${label} sample`}
            className="bw-node-select mt-2 text-xs"
            value={sampleValue}
            onChange={(event) => handleSampleChange(role, event)}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <NodeChrome badge="Logic" label={data.label} description={data.description ?? config.description} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select className="bw-node-select mt-1 text-xs" value={data.operation} onChange={handleOperationChange}>
            <option value="and">AND</option>
            <option value="or">OR</option>
            <option value="not">NOT</option>
          </select>
        </label>
        <div className="space-y-3">
          {config.roles.map((role) => renderInput(role))}
        </div>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`logical-${id}-out`} />
    </div>
  );
};

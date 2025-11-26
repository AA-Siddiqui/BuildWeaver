import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { FunctionArgumentNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { useCursorRestorer } from '../hooks/useCursorRestorer';
import { usePreviewResolver } from '../previewResolver';
import { logicLogger } from '../../../lib/logger';

export const FunctionArgumentNode = ({ id, data }: NodeProps<FunctionArgumentNodeData>) => {
  const updateData = useNodeDataUpdater<FunctionArgumentNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value.trim();
    logicLogger.debug('Function argument renamed', { nodeId: id, argumentId: data.argumentId, name });
    updateData((prev) => ({ ...prev, name }));
    restoreCursor(event.target, { nodeId: id, field: 'name' });
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value as FunctionArgumentNodeData['type'];
    logicLogger.debug('Function argument type updated', { nodeId: id, argumentId: data.argumentId, type });
    updateData((prev) => ({ ...prev, type }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="Argument" label={data.name || 'Argument'} description="Expose input value" preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/70">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
            type="text"
            value={data.name}
            onChange={handleNameChange}
            placeholder="Argument name"
          />
        </label>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/70">
          Type
          <select
            className="bw-node-select mt-1"
            value={data.type}
            onChange={handleTypeChange}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="list">List</option>
            <option value="object">Object</option>
          </select>
        </label>
      </NodeChrome>
      <Handle
        type="source"
        position={Position.Right}
        id={`function-argument-${data.argumentId}`}
        className="!right-[-6px] !h-3 !w-3 !bg-bw-sand"
      />
    </div>
  );
};

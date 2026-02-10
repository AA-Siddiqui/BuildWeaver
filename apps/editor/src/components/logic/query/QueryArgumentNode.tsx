import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryArgumentNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { useCursorRestorer } from '../hooks/useCursorRestorer';
import { usePreviewResolver } from '../previewResolver';
import { logicLogger } from '../../../lib/logger';

const QUERY_ARG_LOGGER_PREFIX = 'QueryArgumentNode';

export const QueryArgumentNode = ({ id, data }: NodeProps<QueryArgumentNodeData>) => {
  const updateData = useNodeDataUpdater<QueryArgumentNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value.trim();
    logicLogger.debug(`[${QUERY_ARG_LOGGER_PREFIX}] name changed`, { nodeId: id, name });
    updateData((prev) => ({ ...prev, name }));
    restoreCursor(event.target, { nodeId: id, field: 'name' });
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value as QueryArgumentNodeData['type'];
    logicLogger.info(`[${QUERY_ARG_LOGGER_PREFIX}] type changed`, { nodeId: id, type });
    updateData((prev) => ({ ...prev, type }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="ARG" label={data.name || 'Argument'} description="Pass external value into query" preview={preview}>
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
        id="output"
        className="!right-[-6px] !h-3 !w-3 !rounded-full !bg-[#DDC57A]"
      />
    </div>
  );
};

import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryLimitNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { useCursorRestorer } from '../hooks/useCursorRestorer';
import { usePreviewResolver } from '../previewResolver';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryLimitNode';

export const QueryLimitNode = ({ id, data }: NodeProps<QueryLimitNodeData>) => {
  const updateData = useNodeDataUpdater<QueryLimitNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);

  const bindingData = previewResolver.getHandleBinding(id, 'input-data');
  const bindingLimit = previewResolver.getHandleBinding(id, 'input-limit');
  const bindingOffset = previewResolver.getHandleBinding(id, 'input-offset');

  const handleLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value === '' ? undefined : Math.max(0, Number(event.target.value));
    logicLogger.debug(`[${LOGGER_PREFIX}] limit changed`, { nodeId: id, value });
    updateData((prev) => ({ ...prev, limitValue: value }));
    restoreCursor(event.target, { nodeId: id, field: 'limit' });
  };

  const handleOffsetChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value === '' ? undefined : Math.max(0, Number(event.target.value));
    logicLogger.debug(`[${LOGGER_PREFIX}] offset changed`, { nodeId: id, value });
    updateData((prev) => ({ ...prev, offsetValue: value }));
    restoreCursor(event.target, { nodeId: id, field: 'offset' });
  };

  return (
    <div className="relative">
      <NodeChrome badge="LIMIT" label="Limit" description="SQL LIMIT / OFFSET" preview={preview}>
        {/* Data input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-data"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Data input</p>
          {bindingData && (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingData.sourceLabel}</p>
            </div>
          )}
        </div>

        {/* Limit input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-limit"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Limit</p>
          {bindingLimit ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingLimit.sourceLabel}</p>
            </div>
          ) : (
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
              value={data.limitValue ?? ''}
              onChange={handleLimitChange}
              placeholder="Max rows"
            />
          )}
        </div>

        {/* Offset input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-offset"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Offset</p>
          {bindingOffset ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingOffset.sourceLabel}</p>
            </div>
          ) : (
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
              value={data.offsetValue ?? ''}
              onChange={handleOffsetChange}
              placeholder="Skip rows"
            />
          )}
        </div>
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

import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { usePreviewResolver } from '../previewResolver';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryNode';

const getHandleOffset = (index: number, total: number) => {
  if (total <= 0) return '50%';
  const percent = ((index + 1) / (total + 1)) * 100;
  return `${percent}%`;
};

const MODE_COLORS: Record<string, string> = {
  read: 'bg-green-600/30 text-green-300',
  insert: 'bg-blue-600/30 text-blue-300',
  update: 'bg-amber-600/30 text-amber-300',
  delete: 'bg-red-600/30 text-red-300'
};

export const QueryNode = ({ id, data }: NodeProps<QueryNodeData>) => {
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const args = data.arguments ?? [];

  logicLogger.debug(`[${LOGGER_PREFIX}] rendering`, { id, queryId: data.queryId, mode: data.mode, argCount: args.length });

  return (
    <div className="relative">
      <NodeChrome badge="QUERY" label={data.queryName || 'Untitled Query'} preview={preview}>
        <div className="flex items-center gap-2">
          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase ${MODE_COLORS[data.mode] ?? 'bg-white/10 text-white'}`}>
            {data.mode}
          </span>
        </div>
        {args.length > 0 && (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white">
            <p className="text-[10px] uppercase tracking-[0.2em] text-bw-platinum/60">Arguments</p>
            <ul className="mt-1 space-y-1">
              {args.map((arg) => (
                <li key={arg.id} className="flex justify-between text-[11px]">
                  <span>{arg.name}</span>
                  <span className="text-bw-platinum/70">{arg.type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {args.length === 0 && (
          <p className="mt-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-2 text-xs text-bw-platinum/70">
            No arguments. Open query to add.
          </p>
        )}
      </NodeChrome>
      {args.map((arg, index) => (
        <Handle
          key={arg.id}
          type="target"
          position={Position.Left}
          id={`input-arg-${arg.id}`}
          className="pointer-events-auto !left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          style={{ top: getHandleOffset(index, args.length) }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="pointer-events-auto !right-[-6px] !h-3 !w-3 !rounded-full !bg-[#DDC57A]"
        style={{ top: '50%' }}
      />
    </div>
  );
};

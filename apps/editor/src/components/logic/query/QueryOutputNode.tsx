import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryOutputNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { usePreviewResolver } from '../previewResolver';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryOutputNode';

export const QueryOutputNode = ({ id }: NodeProps<QueryOutputNodeData>) => {
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);

  logicLogger.debug(`[${LOGGER_PREFIX}] rendered`, { nodeId: id });

  return (
    <div className="relative">
      <NodeChrome badge="OUTPUT" label="Query Result" description="Collects the final query result" preview={preview}>
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-bw-platinum">
          Connect the data pipeline that produces the final query result. This node is required and cannot be removed.
        </p>
      </NodeChrome>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
      />
    </div>
  );
};

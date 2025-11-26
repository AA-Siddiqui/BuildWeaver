import { Handle, NodeProps, Position } from 'reactflow';
import type { FunctionReturnNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { usePreviewResolver } from '../previewResolver';

export const FunctionReturnNode = ({ id, data }: NodeProps<FunctionReturnNodeData>) => {
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);

  return (
    <div className="relative">
      <NodeChrome badge="Return" label="Return Value" description="Emit final value" preview={preview}>
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-bw-platinum">
          Connect the node that represents the final result of your function. Returning is optional.
        </p>
      </NodeChrome>
      <Handle
        type="target"
        position={Position.Left}
        id={`function-return-${data.returnId}`}
        className="!left-[-6px] !h-3 !w-3 !bg-bw-sand"
      />
    </div>
  );
};

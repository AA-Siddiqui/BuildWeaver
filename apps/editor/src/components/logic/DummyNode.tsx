import { Handle, NodeProps, Position } from 'reactflow';
import { DummyNodeData } from '@buildweaver/libs';

export const DummyNode = ({ data }: NodeProps<DummyNodeData>) => {
  return (
    <div className="w-48 rounded-2xl border border-white/10 bg-bw-ink/80 p-4 text-sm text-white shadow-lg">
      <p className="text-xs uppercase tracking-wide text-bw-amber">Dummy</p>
      <p className="mt-1 text-lg font-semibold">{data.value}</p>
      <p className="text-xs text-bw-platinum/70">Static output</p>
      <Handle
        id="dummy-output"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-bw-sand"
      />
    </div>
  );
};

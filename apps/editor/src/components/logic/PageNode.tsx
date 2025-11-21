import { MouseEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';
import { PageNodeData } from '@buildweaver/libs';

export const PageNode = ({ data, selected }: NodeProps<PageNodeData>) => {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const handleOpenBuilder = (event: MouseEvent) => {
    event.stopPropagation();
    if (!projectId) {
      return;
    }
    navigate(`/app/${projectId}/page/${data.pageId}`);
  };

  return (
    <div
      className={`w-64 rounded-2xl border ${selected ? 'border-bw-sand' : 'border-white/10'} bg-white/5 p-4 text-sm text-white shadow-xl backdrop-blur`}
    >
      <button
        type="button"
        className="flex w-full flex-col items-start rounded-xl bg-white/10 px-3 py-2 text-left transition hover:bg-white/15"
        onClick={handleOpenBuilder}
      >
        <span className="text-xs uppercase tracking-wide text-bw-amber">Page</span>
        <span className="text-lg font-semibold">{data.pageName}</span>
        {data.routeSegment && <span className="text-xs text-bw-platinum/70">/{data.routeSegment}</span>}
      </button>

      <div className="mt-3 space-y-2">
        {data.inputs.length === 0 ? (
          <p className="text-xs text-bw-platinum/60">No dynamic fields yet</p>
        ) : (
          data.inputs.map((input: PageNodeData['inputs'][number]) => (
            <div key={input.id} className="relative rounded-lg border border-white/10 bg-bw-ink/40 px-3 py-2 text-xs">
              <Handle
                type="target"
                id={input.id}
                position={Position.Left}
                className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
              />
              <p className="font-semibold text-white">{input.label}</p>
              {input.description && <p className="text-[10px] text-bw-platinum/70">{input.description}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

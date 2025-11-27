import { memo, useState, MouseEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { useLogicEdgeActions } from './LogicEdgeActionsContext';

export const SeverableEdge = memo((props: EdgeProps) => {
  const { id } = props;
  const { severEdge } = useLogicEdgeActions();
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath(props);

  const handleSever = (event: MouseEvent) => {
    event.stopPropagation();
    severEdge(id, { reason: 'hover-button' });
  };

  return (
    <>
      <g
        data-testid={`edge-wrapper-${id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <BaseEdge
          {...props}
          path={edgePath}
          style={{
            stroke: hovered ? '#DDC57A' : '#F9E7B2',
            strokeWidth: hovered ? 3 : 2,
            transition: 'stroke 120ms ease, stroke-width 120ms ease'
          }}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          className={`pointer-events-none absolute transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
          }}
        >
          <button
            type="button"
            aria-label="Sever connection"
            data-testid={`sever-button-${id}`}
            className="pointer-events-auto rounded-full bg-bw-ink/80 px-2 py-1 text-xs font-semibold text-bw-sand shadow-lg ring-1 ring-bw-sand/60 transition hover:bg-bw-ink"
            onClick={handleSever}
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

SeverableEdge.displayName = 'SeverableEdge';

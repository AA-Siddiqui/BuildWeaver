import { DragEvent } from 'react';

export const QUERY_NODE_DRAG_DATA = 'application/buildweaver/query-node';

export type QueryPaletteNodeType =
  | 'query-argument'
  | 'query-table'
  | 'query-join'
  | 'query-where'
  | 'query-groupby'
  | 'query-having'
  | 'query-orderby'
  | 'query-limit'
  | 'query-aggregation'
  | 'query-attribute';

const paletteItems: Array<{ type: QueryPaletteNodeType; label: string; description: string }> = [
  { type: 'query-argument', label: 'Argument', description: 'Pass external value into query' },
  { type: 'query-table', label: 'Table', description: 'Reference a database table' },
  { type: 'query-join', label: 'Join', description: 'SQL JOIN clause' },
  { type: 'query-where', label: 'Where', description: 'SQL WHERE filter' },
  { type: 'query-groupby', label: 'Group By', description: 'SQL GROUP BY clause' },
  { type: 'query-having', label: 'Having', description: 'SQL HAVING filter' },
  { type: 'query-orderby', label: 'Order By', description: 'SQL ORDER BY clause' },
  { type: 'query-limit', label: 'Limit', description: 'SQL LIMIT / OFFSET' },
  { type: 'query-aggregation', label: 'Aggregation', description: 'SQL aggregate function' },
  { type: 'query-attribute', label: 'Attribute', description: 'Reference a table column' }
];

interface QueryNodePaletteProps {
  onAddNode: (type: QueryPaletteNodeType) => void;
}

export const QueryNodePalette = ({ onAddNode }: QueryNodePaletteProps) => {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: QueryPaletteNodeType) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="flex w-72 max-h-screen overflow-y-auto flex-col gap-3 border-r border-white/10 bg-bw-ink/90 p-4 text-sm text-white">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Query nodes</p>
        <p className="mt-1 text-xs text-bw-platinum/70">Drag or click to add nodes</p>
      </div>
      {paletteItems.map((item) => (
        <button
          key={item.type}
          type="button"
          draggable
          onDragStart={(event) => handleDragStart(event, item.type)}
          onClick={() => onAddNode(item.type)}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:-translate-y-0.5 hover:border-bw-sand"
        >
          <p className="text-base font-semibold text-white">{item.label}</p>
          <p className="text-xs text-bw-platinum/70">{item.description}</p>
        </button>
      ))}
    </aside>
  );
};

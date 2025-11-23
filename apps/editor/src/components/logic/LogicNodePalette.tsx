import { DragEvent } from 'react';

export type PaletteNodeType = 'page' | 'dummy' | 'arithmetic' | 'string' | 'list' | 'object';

interface LogicNodePaletteProps {
  onAddNode: (type: PaletteNodeType) => void;
}

const paletteItems: Array<{ type: PaletteNodeType; label: string; description: string }> = [
  { type: 'page', label: 'Page', description: 'Render UI and dynamic data' },
  { type: 'dummy', label: 'Dummy', description: 'Static sample outputs' },
  { type: 'arithmetic', label: 'Arithmetic', description: 'Math operators and aggregations' },
  { type: 'string', label: 'String', description: 'Text transforms (concat, slice, etc.)' },
  { type: 'list', label: 'List', description: 'List merge, slice, sort, count' },
  { type: 'object', label: 'Object', description: 'Merge, pick, set, and query objects' }
];

export const LogicNodePalette = ({ onAddNode }: LogicNodePaletteProps) => {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: PaletteNodeType) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="flex w-64 flex-col gap-4 border-r border-white/10 bg-bw-ink/90 p-4 text-sm text-white">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Node palette</p>
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

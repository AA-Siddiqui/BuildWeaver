import { DragEvent, KeyboardEvent } from 'react';
import type { ExtendedPaletteNodeType, PaletteNodeType } from './nodeFactories';

export const FUNCTION_DRAG_DATA = 'application/buildweaver/function';

interface UserFunctionListItem {
  id: string;
  name: string;
  returnsValue: boolean;
}

interface LogicNodePaletteProps {
  onAddNode: (type: PaletteNodeType) => void;
  userFunctions?: UserFunctionListItem[];
  onCreateFunction?: () => void;
  onEditFunction?: (functionId: string) => void;
  onDeleteFunction?: (functionId: string) => void;
  onAddFunctionNode?: (functionId: string) => void;
  extraItems?: Array<{ type: ExtendedPaletteNodeType; label: string; description: string }>;
  onAddExtraNode?: (type: ExtendedPaletteNodeType) => void;
  disablePageNode?: boolean;
  pageRoutes?: string[];
  isPageRoutesLoading?: boolean;
  pageRoutesError?: string;
  onOpenDatabaseDesigner?: () => void;
  onEditDatabase?: (schemaId: string) => void;
  databases?: Array<{ id: string; name: string; tableCount: number }>;
}

const basePaletteItems: Array<{ type: PaletteNodeType; label: string; description: string }> = [
  { type: 'page', label: 'Page', description: 'Create a new UI surface' },
  { type: 'dummy', label: 'Dummy', description: 'Static sample outputs' },
  { type: 'arithmetic', label: 'Arithmetic', description: 'Math operators and aggregations' },
  { type: 'string', label: 'String', description: 'Text transforms (concat, slice, etc.)' },
  { type: 'list', label: 'List', description: 'List merge, slice, sort, count' },
  { type: 'object', label: 'Object', description: 'Merge, pick, set, and query objects' },
  { type: 'conditional', label: 'If / Conditional', description: 'Route values based on boolean checks' },
  { type: 'logical', label: 'Logical Operator', description: 'AND, OR, and NOT gates' },
  { type: 'relational', label: 'Relational Operator', description: 'Compare two values (>, <, =)' }
];

export const LogicNodePalette = ({
  onAddNode,
  userFunctions,
  onCreateFunction,
  onEditFunction,
  onDeleteFunction,
  onAddFunctionNode,
  extraItems,
  onAddExtraNode,
  disablePageNode,
  pageRoutes,
  isPageRoutesLoading,
  pageRoutesError,
  onOpenDatabaseDesigner,
  onEditDatabase,
  databases
}: LogicNodePaletteProps) => {
  const paletteItems = disablePageNode ? basePaletteItems.filter((item) => item.type !== 'page') : basePaletteItems;

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: ExtendedPaletteNodeType) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFunctionDragStart = (event: DragEvent<HTMLElement>, functionId: string) => {
    event.dataTransfer.setData(FUNCTION_DRAG_DATA, JSON.stringify({ functionId }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFunctionKeyDown = (event: KeyboardEvent<HTMLDivElement>, functionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAddFunctionNode?.(functionId);
    }
  };

  const formattedRoutes = (pageRoutes ?? []).map((route) => {
    if (!route) {
      return '/';
    }
    return route.startsWith('/') ? route : `/${route}`;
  });

  return (
    <aside className="flex w-72 max-h-screen overflow-y-scroll flex-col gap-4 border-r border-white/10 bg-bw-ink/90 p-4 text-sm text-white">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Node palette</p>
        <p className="mt-1 text-xs text-bw-platinum/70">Drag or click to add nodes</p>
      </div>
      {onOpenDatabaseDesigner && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-bw-amber">Database</p>
              <p className="text-xs text-bw-platinum/70">Design entity relationships</p>
            </div>
            <button
              type="button"
              onClick={onOpenDatabaseDesigner}
              className="rounded-xl border border-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:-translate-y-0.5"
            >
              Design DB
            </button>
          </div>
          {databases && databases.length > 0 ? (
            <ul className="space-y-1 text-xs text-bw-platinum/80">
              {databases.map((db) => (
                <li key={db.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-bw-ink/60 px-3 py-2">
                  <div>
                    <p className="font-semibold text-white">{db.name}</p>
                    <p className="text-[11px] text-bw-platinum/70">{db.tableCount} table{db.tableCount === 1 ? '' : 's'}</p>
                  </div>
                  {onEditDatabase && (
                    <button
                      type="button"
                      onClick={() => onEditDatabase(db.id)}
                      className="text-[11px] text-bw-sand underline"
                    >
                      Edit
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-bw-platinum/70">No databases yet.</p>
          )}
        </div>
      )}
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
      {extraItems?.length ? (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-bw-amber">Function tools</p>
          {extraItems.map((item) => (
            <button
              key={item.label}
              type="button"
              draggable
              onDragStart={(event) => handleDragStart(event, item.type)}
              onClick={() => onAddExtraNode?.(item.type)}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-white transition hover:-translate-y-0.5"
            >
              <p className="text-base font-semibold">{item.label}</p>
              <p className="text-xs text-bw-platinum/70">{item.description}</p>
            </button>
          ))}
        </div>
      ) : null}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">User functions</p>
            <p className="text-[11px] text-bw-platinum/70">Drag to reuse across flows</p>
          </div>
          {onCreateFunction && (
            <button
              type="button"
              onClick={onCreateFunction}
              className="rounded-xl border border-white/20 px-3 py-1 text-[11px] font-semibold text-white"
            >
              New
            </button>
          )}
        </div>
        {userFunctions && userFunctions.length > 0 ? (
          <div className="space-y-2">
            {userFunctions.map((fn) => (
              <div
                key={fn.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(event) => handleFunctionDragStart(event, fn.id)}
                onClick={() => onAddFunctionNode?.(fn.id)}
                onKeyDown={(event) => handleFunctionKeyDown(event, fn.id)}
                className="group w-full rounded-xl border border-white/10 bg-bw-ink/70 p-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-bw-sand"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{fn.name}</p>
                    <p className="text-[11px] text-bw-platinum/60">
                      {fn.returnsValue ? 'Returns a value' : 'No return value'}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                    {onEditFunction && (
                      <button
                        type="button"
                        className="text-[11px] text-bw-sand"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditFunction(fn.id);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {onDeleteFunction && (
                      <button
                        type="button"
                        className="text-[11px] text-red-300"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteFunction(fn.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/20 px-3 py-4 text-center text-xs text-bw-platinum/70">
            No user functions yet.
          </p>
        )}
      </div>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Routes in use</p>
            <p className="text-[11px] text-bw-platinum/70">Keep routes unique per page</p>
          </div>
        </div>
        {pageRoutesError ? (
          <p className="text-xs text-red-300" data-testid="page-routes-error">
            {pageRoutesError}
          </p>
        ) : isPageRoutesLoading ? (
          <p className="text-xs text-bw-platinum/70">Loading routes…</p>
        ) : formattedRoutes.length ? (
          <ul className="space-y-1 text-xs text-bw-platinum/80">
            {formattedRoutes.map((route) => (
              <li key={route} className="flex items-center gap-2">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-bw-sand" />
                <span>{route}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-bw-platinum/70">No pages yet.</p>
        )}
      </div>
    </aside>
  );
};

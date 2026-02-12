import { DragEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Connection,
  Controls,
  EdgeChange,
  MiniMap,
  Node,
  NodeChange,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow
} from 'reactflow';
import type {
  QueryArgumentNodeData,
  QueryDefinition,
  QueryMode,
  DatabaseSchema,
  LogicEditorNodeData
} from '@buildweaver/libs';
import {
  FlowEdge,
  FlowNode,
  serializeEdges,
  serializeNodes,
  toFlowEdges,
  toFlowNodes
} from '../graphSerialization';
import { PreviewResolverProvider, createPreviewResolver } from '../previewResolver';
import { queryEditorLogger } from '../../../lib/logger';
import { processEditorShortcut } from '../../../lib/editorShortcuts';
import { useDeleteNodesShortcut } from '../../../hooks/useDeleteNodesShortcut';
import { useEdgeCutGesture } from '../../../hooks/useEdgeCutGesture';
import { SnapshotHistory } from '../../../lib/snapshotHistory';
import { QuerySchemaProvider } from './QuerySchemaContext';
import { QueryNodePalette, QueryPaletteNodeType } from './QueryNodePalette';
import { QueryArgumentNode } from './QueryArgumentNode';
import { QueryOutputNode } from './QueryOutputNode';
import { QueryTableNode } from './QueryTableNode';
import { QueryJoinNode } from './QueryJoinNode';
import { QueryWhereNode } from './QueryWhereNode';
import { QueryGroupByNode } from './QueryGroupByNode';
import { QueryHavingNode } from './QueryHavingNode';
import { QueryOrderByNode } from './QueryOrderByNode';
import { QueryLimitNode } from './QueryLimitNode';
import { QueryAggregationNode } from './QueryAggregationNode';
import { QueryAttributeNode } from './QueryAttributeNode';

const nodeTypes = {
  'query-argument': QueryArgumentNode,
  'query-output': QueryOutputNode,
  'query-table': QueryTableNode,
  'query-join': QueryJoinNode,
  'query-where': QueryWhereNode,
  'query-groupby': QueryGroupByNode,
  'query-having': QueryHavingNode,
  'query-orderby': QueryOrderByNode,
  'query-limit': QueryLimitNode,
  'query-aggregation': QueryAggregationNode,
  'query-attribute': QueryAttributeNode
};

const QUERY_DRAG_DATA = 'application/reactflow';

const MODES: QueryMode[] = ['read', 'insert', 'update', 'delete'];

const MODE_BUTTON_COLORS: Record<QueryMode, string> = {
  read: 'bg-green-600 hover:bg-green-500',
  insert: 'bg-blue-600 hover:bg-blue-500',
  update: 'bg-amber-600 hover:bg-amber-500',
  delete: 'bg-red-600 hover:bg-red-500'
};

const MODE_INACTIVE_COLORS: Record<QueryMode, string> = {
  read: 'border-green-600/40 text-green-400 hover:bg-green-600/20',
  insert: 'border-blue-600/40 text-blue-400 hover:bg-blue-600/20',
  update: 'border-amber-600/40 text-amber-400 hover:bg-amber-600/20',
  delete: 'border-red-600/40 text-red-400 hover:bg-red-600/20'
};

export type QueryInnerNodeType = QueryPaletteNodeType | 'query-output';

export const createQueryInnerNode = (type: QueryInnerNodeType, position = { x: 0, y: 0 }): FlowNode => {
  const nodeId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const defaults: Record<QueryInnerNodeType, LogicEditorNodeData> = {
    'query-argument': { kind: 'query-argument', argumentId: nodeId, name: 'arg', type: 'string' },
    'query-output': { kind: 'query-output', outputId: nodeId },
    'query-table': { kind: 'query-table', tableId: '', tableName: '', schemaId: '', selectedColumns: [], columnDefaults: {}, aggregationInputCount: 0 },
    'query-join': { kind: 'query-join', joinType: 'inner' },
    'query-where': { kind: 'query-where', operator: '=', leftIsColumn: true, rightIsColumn: false },
    'query-groupby': { kind: 'query-groupby', groupingAttributeCount: 1, attributes: [] },
    'query-having': { kind: 'query-having', operator: '=', leftIsColumn: true, rightIsColumn: false },
    'query-orderby': { kind: 'query-orderby', sortCount: 1, sortAttributes: [], sortOrders: ['asc'] },
    'query-limit': { kind: 'query-limit' },
    'query-aggregation': { kind: 'query-aggregation', function: 'count' },
    'query-attribute': { kind: 'query-attribute' }
  };
  return { id: nodeId, type, position, data: defaults[type] };
};

/** Snapshot for query editor undo/redo. */
export type QueryEditorSnapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  name: string;
  mode: QueryMode;
};

const QUERY_HISTORY_LIMIT = 100;

const cloneQuerySnapshot = (snapshot: QueryEditorSnapshot): QueryEditorSnapshot =>
  JSON.parse(JSON.stringify(snapshot));

const hashQuerySnapshot = (snapshot: QueryEditorSnapshot): string =>
  JSON.stringify({ n: snapshot.nodes.map((n) => ({ id: n.id, d: n.data, p: n.position })), e: snapshot.edges.map((e) => e.id), nm: snapshot.name, m: snapshot.mode });

interface QueryEditorModalProps {
  queryDef: QueryDefinition;
  schema: DatabaseSchema | null;
  onSave: (query: QueryDefinition) => void;
  onClose: () => void;
}

const QueryEditorCanvas = ({ queryDef, schema, onSave, onClose }: QueryEditorModalProps) => {
  const [name, setName] = useState(queryDef.name);
  const [mode, setMode] = useState<QueryMode>(queryDef.mode);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow<Node<LogicEditorNodeData>>();
  const [nodes, setNodes, onNodesChange] = useNodesState<LogicEditorNodeData>(toFlowNodes(queryDef.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(queryDef.edges));
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const previewResolver = useMemo(
    () => createPreviewResolver(nodes, edges, { querySchema: schema, queryMode: mode }),
    [nodes, edges, schema, mode]
  );
  const connectionLineStyle = useMemo(() => ({ stroke: '#F9E7B2', strokeWidth: 2 }), []);

  // -- Undo / redo history --------------------------------------------------
  const historyRef = useRef(
    new SnapshotHistory<QueryEditorSnapshot>({
      clone: cloneQuerySnapshot,
      hash: hashQuerySnapshot,
      limit: QUERY_HISTORY_LIMIT,
      logger: (message, meta) => queryEditorLogger.debug(message, meta)
    })
  );

  /** Observe query state changes for undo/redo snapshots. */
  useLayoutEffect(() => {
    const snapshot: QueryEditorSnapshot = { nodes, edges, name, mode };
    historyRef.current.observe(snapshot, {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      reason: 'query-state-observer'
    });
  }, [nodes, edges, name, mode]);

  const restoreSnapshot = useCallback(
    (snapshot: QueryEditorSnapshot, action: 'undo' | 'redo') => {
      historyRef.current.suppressNextDiff();
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setName(snapshot.name);
      setMode(snapshot.mode);
      setHasUnsavedChanges(true);
      const label = action === 'undo' ? 'Undid change' : 'Redid change';
      setFeedback(label);
      setTimeout(() => setFeedback(''), 2000);
      queryEditorLogger.info(`Query ${action} applied`, {
        undoDepth: historyRef.current.getUndoDepth(),
        redoDepth: historyRef.current.getRedoDepth(),
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length
      });
    },
    [setEdges, setNodes]
  );

  const handleUndo = useCallback(() => {
    const current: QueryEditorSnapshot = { nodes, edges, name, mode };
    const snapshot = historyRef.current.undo(current);
    if (!snapshot) {
      queryEditorLogger.debug('Undo ignored — no history');
      return;
    }
    restoreSnapshot(snapshot, 'undo');
  }, [edges, mode, name, nodes, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const current: QueryEditorSnapshot = { nodes, edges, name, mode };
    const snapshot = historyRef.current.redo(current);
    if (!snapshot) {
      queryEditorLogger.debug('Redo ignored — no future history');
      return;
    }
    restoreSnapshot(snapshot, 'redo');
  }, [edges, mode, name, nodes, restoreSnapshot]);

  // -- Select all nodes ------------------------------------------------------
  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: true })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
    const count = nodes.length;
    queryEditorLogger.info('Select all triggered', { nodeCount: count, edgeCount: edges.length });
    setFeedback(count ? `Selected ${count} node${count > 1 ? 's' : ''}` : 'No nodes to select');
    setTimeout(() => setFeedback(''), 2000);
  }, [edges.length, nodes.length, setEdges, setNodes]);

  // Sync nodes/edges from queryDef and auto-create query-output if missing
  useEffect(() => {
    const flowNodes = toFlowNodes(queryDef.nodes);
    const hasOutput = flowNodes.some((node) => node.type === 'query-output');
    if (!hasOutput) {
      const outputNode = createQueryInnerNode('query-output', { x: 600, y: 200 });
      flowNodes.push(outputNode);
      queryEditorLogger.info('Auto-created query-output node', { queryId: queryDef.id, nodeId: outputNode.id });
    }
    setNodes(flowNodes);
    setEdges(toFlowEdges(queryDef.edges));
    setName(queryDef.name);
    setMode(queryDef.mode);
    setHasUnsavedChanges(false);
    setSelectedNodeIds([]);
    setFeedback('');
    historyRef.current.reset(
      { nodes: flowNodes, edges: toFlowEdges(queryDef.edges), name: queryDef.name, mode: queryDef.mode },
      { reason: 'query-def-loaded', queryId: queryDef.id }
    );
    queryEditorLogger.info('Query definition loaded into editor', {
      queryId: queryDef.id,
      nodeCount: flowNodes.length,
      edgeCount: queryDef.edges.length,
      mode: queryDef.mode
    });
  }, [queryDef, setEdges, setNodes]);

  const deleteElements = useCallback(
    (elements: { nodes?: FlowNode[]; edges?: FlowEdge[] }) => {
      // Prevent deletion of query-output nodes
      if (elements.nodes) {
        const outputNodes = elements.nodes.filter((node) => node.type === 'query-output');
        if (outputNodes.length > 0) {
          setFeedback('Cannot delete the output node');
          setTimeout(() => setFeedback(''), 2000);
          queryEditorLogger.warn('Attempted to delete protected query-output node', {
            outputNodeIds: outputNodes.map((n) => n.id)
          });
          const filtered = elements.nodes.filter((node) => node.type !== 'query-output');
          if (filtered.length === 0 && !elements.edges?.length) {
            return;
          }
          reactFlowInstance.deleteElements({ nodes: filtered, edges: elements.edges });
          return;
        }
      }
      reactFlowInstance.deleteElements(elements);
    },
    [reactFlowInstance]
  );

  const deleteSelection = useDeleteNodesShortcut({
    nodes,
    selectedNodeIds,
    deleteElements,
    onNodesDeleted: (removedIds) => {
      if (!removedIds.length) {
        return;
      }
      setSelectedNodeIds((current) => current.filter((id) => !removedIds.includes(id)));
      setHasUnsavedChanges(true);
      setFeedback(`Deleted ${removedIds.length} node${removedIds.length > 1 ? 's' : ''}`);
      setTimeout(() => setFeedback(''), 2000);
    },
    logger: (message, meta) => queryEditorLogger.warn(message, meta)
  });

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Prevent removal of query-output nodes via keyboard/other means
      const filtered = changes.filter((change) => {
        if (change.type === 'remove') {
          const node = nodes.find((n) => n.id === change.id);
          if (node?.type === 'query-output') {
            setFeedback('Cannot delete the output node');
            setTimeout(() => setFeedback(''), 2000);
            queryEditorLogger.warn('Blocked removal of query-output node', { nodeId: change.id });
            return false;
          }
        }
        return true;
      });
      setHasUnsavedChanges(true);
      onNodesChange(filtered);
    },
    [nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setHasUnsavedChanges(true);
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      // Enforce single-input restriction on query-output nodes
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (targetNode?.type === 'query-output') {
        const existing = edges.filter(
          (e) => e.target === connection.target && e.targetHandle === (connection.targetHandle ?? 'input')
        );
        if (existing.length > 0) {
          queryEditorLogger.warn('Blocked duplicate connection to query-output node', {
            target: connection.target,
            existingEdge: existing[0].id,
            attemptedSource: connection.source
          });
          setFeedback('Output node already has an input — remove the existing connection first');
          setTimeout(() => setFeedback(''), 2500);
          return;
        }
      }
      queryEditorLogger.info('Query editor connection created', {
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle
      });
      setEdges((eds) => addEdge({ ...connection, id: `${connection.source}-${connection.target}-${Date.now()}` }, eds));
      setHasUnsavedChanges(true);
    },
    [edges, nodes, setEdges]
  );

  const handleAddNode = useCallback(
    (type: QueryPaletteNodeType, position?: { x: number; y: number }) => {
      const node = createQueryInnerNode(type, position);
      queryEditorLogger.info('Query node added', { type, nodeId: node.id, position });
      setNodes((current) => current.concat(node));
      setHasUnsavedChanges(true);
    },
    [setNodes]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0)
      });
      const type = event.dataTransfer.getData(QUERY_DRAG_DATA) as QueryPaletteNodeType | undefined;
      if (!type) {
        return;
      }
      handleAddNode(type, position);
    },
    [handleAddNode, reactFlowInstance]
  );

  const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: FlowNode[] }) => {
    setSelectedNodeIds(selected.map((node) => node.id));
  }, []);

  const serializedArguments = useCallback(() => {
    const entries = serializeNodes(nodes).filter((node) => node.type === 'query-argument');
    return entries.map((node) => {
      const data = node.data as QueryArgumentNodeData;
      return {
        id: data.argumentId,
        name: data.name,
        type: data.type
      };
    });
  }, [nodes]);

  const handleSave = useCallback(() => {
    const serializedNodes = serializeNodes(nodes);
    const serializedEdges = serializeEdges(edges);
    const updated: QueryDefinition = {
      ...queryDef,
      name: name.trim() || 'Untitled query',
      mode,
      nodes: serializedNodes,
      edges: serializedEdges,
      arguments: serializedArguments(),
      updatedAt: new Date().toISOString()
    };
    queryEditorLogger.info('Query editor saved changes', {
      queryId: updated.id,
      mode: updated.mode,
      nodes: updated.nodes.length,
      edges: updated.edges.length,
      arguments: updated.arguments.length
    });
    onSave(updated);
    setHasUnsavedChanges(false);
    setFeedback('Query saved');
    setTimeout(() => setFeedback(''), 1500);
  }, [edges, mode, name, nodes, onSave, queryDef, serializedArguments]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      queryEditorLogger.info('Auto-saving query before close', { queryId: queryDef.id });
      handleSave();
    }
    onClose();
  }, [handleSave, hasUnsavedChanges, onClose, queryDef.id]);

  // -- Keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+A) ------------------
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      processEditorShortcut(event, {
        onSave: () => {
          queryEditorLogger.info('Save shortcut triggered', { queryId: queryDef.id });
          handleSave();
        },
        onUndo: handleUndo,
        onRedo: handleRedo,
        onSelectAll: handleSelectAll,
        logger: (message, meta) => queryEditorLogger.info(message, { ...meta, context: 'query-editor' })
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleSave, handleSelectAll, handleUndo, queryDef.id]);

  // -- Edge cut gesture (Ctrl+LMB drag) -------------------------------------
  const severEdges = useCallback(
    (edgeIds: string[]) => {
      if (!edgeIds.length) {
        queryEditorLogger.debug('Edge sever requested without targets');
        return;
      }
      setEdges((current) => current.filter((edge) => !edgeIds.includes(edge.id)));
      setHasUnsavedChanges(true);
      setFeedback(`Removed ${edgeIds.length} connection${edgeIds.length > 1 ? 's' : ''}`);
      setTimeout(() => setFeedback(''), 2000);
      queryEditorLogger.info('Connections severed via cut gesture', {
        count: edgeIds.length,
        edgeIds
      });
    },
    [setEdges]
  );

  const { edgeCutGesture } = useEdgeCutGesture({
    wrapperRef: reactFlowWrapper,
    reactFlowInstance,
    edges,
    onSever: severEdges,
    logger: (message, meta) => queryEditorLogger.debug(message, meta)
  });

  // -- Restrict query-output node to a single input connection ---------------
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (targetNode?.type === 'query-output') {
        const existing = edges.filter(
          (e) => e.target === connection.target && e.targetHandle === (connection.targetHandle ?? 'input')
        );
        if (existing.length > 0) {
          queryEditorLogger.info('Rejected connection to query-output — already has an input', {
            target: connection.target,
            existingEdge: existing[0].id
          });
          return false;
        }
      }
      return true;
    },
    [edges, nodes]
  );

  return (
    <div className="fixed inset-0 z-50 flex h-screen bg-bw-ink text-white">
      <QueryNodePalette onAddNode={handleAddNode} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 bg-bw-ink/90 px-6 py-4">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setHasUnsavedChanges(true);
              }}
              className="rounded-xl border border-white/10 bg-bw-ink/60 px-4 py-2 text-lg font-semibold"
              placeholder="Query name"
            />
            <div className="flex items-center gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setHasUnsavedChanges(true);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase transition ${
                    mode === m
                      ? `${MODE_BUTTON_COLORS[m]} text-white`
                      : `border ${MODE_INACTIVE_COLORS[m]}`
                  }`}
                >
                  {m}
                </button>
              ))}
              {schema && (
                <span className="ml-2 rounded-lg bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-bw-platinum/60">
                  {schema.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {feedback && <span className="text-bw-platinum/70">{feedback}</span>}
            <button
              type="button"
              onClick={deleteSelection}
              disabled={selectedNodeIds.length === 0}
              className="rounded-xl border border-white/20 px-4 py-2 text-bw-platinum transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete selection
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-bw-sand px-4 py-2 font-semibold text-bw-ink transition hover:-translate-y-0.5"
            >
              Save query
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-white/20 px-4 py-2 font-semibold text-white"
            >
              Return
            </button>
          </div>
        </header>
        <div className="relative flex-1">
          <div ref={reactFlowWrapper} className="h-full">
            <QuerySchemaProvider schema={schema} mode={mode}>
              <PreviewResolverProvider resolver={previewResolver}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  isValidConnection={isValidConnection}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onSelectionChange={handleSelectionChange}
                  fitView
                  panOnDrag
                  panOnScroll
                  zoomOnScroll
                  connectionLineStyle={connectionLineStyle}
                >
                  <MiniMap pannable zoomable className="!bg-bw-ink/80" />
                  <Controls />
                  <Background gap={16} color="#ffffff33" />
                </ReactFlow>
              </PreviewResolverProvider>
            </QuerySchemaProvider>
          </div>
          {edgeCutGesture && (
            <div className="pointer-events-none absolute inset-0">
              <svg className="h-full w-full" data-testid="query-edge-cut-overlay">
                <line
                  x1={edgeCutGesture.startScreen.x}
                  y1={edgeCutGesture.startScreen.y}
                  x2={edgeCutGesture.currentScreen.x}
                  y2={edgeCutGesture.currentScreen.y}
                  stroke="#D34E4E"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const QueryEditorModal = (props: QueryEditorModalProps) => (
  <ReactFlowProvider>
    <QueryEditorCanvas {...props} />
  </ReactFlowProvider>
);

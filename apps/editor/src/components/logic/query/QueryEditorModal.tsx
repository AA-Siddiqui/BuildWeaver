import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { logicLogger } from '../../../lib/logger';
import { useDeleteNodesShortcut } from '../../../hooks/useDeleteNodesShortcut';
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

  // Sync nodes/edges from queryDef and auto-create query-output if missing
  useEffect(() => {
    const flowNodes = toFlowNodes(queryDef.nodes);
    const hasOutput = flowNodes.some((node) => node.type === 'query-output');
    if (!hasOutput) {
      const outputNode = createQueryInnerNode('query-output', { x: 600, y: 200 });
      flowNodes.push(outputNode);
      logicLogger.info('Auto-created query-output node', { queryId: queryDef.id, nodeId: outputNode.id });
    }
    setNodes(flowNodes);
    setEdges(toFlowEdges(queryDef.edges));
    setName(queryDef.name);
    setMode(queryDef.mode);
    setHasUnsavedChanges(false);
    setSelectedNodeIds([]);
    setFeedback('');
  }, [queryDef, setEdges, setNodes]);

  const deleteElements = useCallback(
    (elements: { nodes?: FlowNode[]; edges?: FlowEdge[] }) => {
      // Prevent deletion of query-output nodes
      if (elements.nodes) {
        const outputNodes = elements.nodes.filter((node) => node.type === 'query-output');
        if (outputNodes.length > 0) {
          setFeedback('Cannot delete the output node');
          setTimeout(() => setFeedback(''), 2000);
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
    }
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
      setEdges((eds) => addEdge({ ...connection, id: `${connection.source}-${connection.target}-${Date.now()}` }, eds));
      setHasUnsavedChanges(true);
    },
    [setEdges]
  );

  const handleAddNode = useCallback(
    (type: QueryPaletteNodeType, position?: { x: number; y: number }) => {
      const node = createQueryInnerNode(type, position);
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
    logicLogger.info('Query editor saved changes', {
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
      handleSave();
    }
    onClose();
  }, [handleSave, hasUnsavedChanges, onClose]);

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

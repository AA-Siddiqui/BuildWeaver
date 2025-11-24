import {
  Background,
  Connection,
  Controls,
  Edge,
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
import 'reactflow/dist/style.css';
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  ArithmeticNodeData,
  DummyNodeData,
  ListNodeData,
  LogicEditorEdge,
  LogicEditorNode,
  LogicEditorNodeData,
  ObjectNodeData,
  PageDocument,
  ProjectGraphSnapshot,
  StringNodeData
} from '../types/api';
import { projectGraphApi, projectPagesApi } from '../lib/api-client';
import { LogicNodePalette, PaletteNodeType } from '../components/logic/LogicNodePalette';
import { DummyNode } from '../components/logic/DummyNode';
import { PageNode } from '../components/logic/PageNode';
import { ArithmeticNode } from '../components/logic/ArithmeticNode';
import { StringNode } from '../components/logic/StringNode';
import { ListNode } from '../components/logic/ListNode';
import { ObjectNode } from '../components/logic/ObjectNode';
import { PreviewResolverProvider, createPreviewResolver } from '../components/logic/previewResolver';
import { logicLogger } from '../lib/logger';
import { useDeleteNodesShortcut } from '../hooks/useDeleteNodesShortcut';
import { LogicNavigationProvider } from '../components/logic/LogicNavigationContext';
import { deriveDefaultPageName, normalizeRouteSegment } from '../lib/routes';

const nodeTypes = {
  dummy: DummyNode,
  page: PageNode,
  arithmetic: ArithmeticNode,
  string: StringNode,
  list: ListNode,
  object: ObjectNode
};

type FlowNode = Node<LogicEditorNodeData>;
type FlowEdge = Edge;

export const isTargetHandleFree = (edges: Edge[], connection: Partial<Connection>): boolean => {
  if (!connection.target || !connection.targetHandle) {
    return true;
  }
  return !edges.some(
    (edge) => edge.target === connection.target && edge.targetHandle === connection.targetHandle
  );
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const DEFAULT_DUMMY_DATA: DummyNodeData = {
  kind: 'dummy',
  label: 'Sample data',
  description: 'Placeholder output',
  sample: {
    type: 'integer',
    value: 42
  }
};

const createDummyData = (): DummyNodeData => ({
  ...DEFAULT_DUMMY_DATA,
  sample: { ...DEFAULT_DUMMY_DATA.sample }
});

const createArithmeticData = (): ArithmeticNodeData => ({
  kind: 'arithmetic',
  label: 'Math block',
  description: 'Combine numbers',
  operation: 'add',
  precision: 2,
  operands: [
    { id: `op-${generateId()}`, label: 'Input A', sampleValue: 12 },
    { id: `op-${generateId()}`, label: 'Input B', sampleValue: 4 }
  ]
});

const createStringData = (): StringNodeData => ({
  kind: 'string',
  label: 'String block',
  description: 'Transform strings',
  operation: 'concat',
  stringInputs: [
    { id: `str-${generateId()}`, label: 'Text 1', role: 'text', sampleValue: 'Hello' },
    { id: `str-${generateId()}`, label: 'Text 2', role: 'text', sampleValue: 'World' },
    { id: `str-${generateId()}`, label: 'Delimiter', role: 'delimiter', sampleValue: ' ' }
  ],
  options: { delimiter: ' ' },
  limit: 5
});

const createListData = (): ListNodeData => ({
  kind: 'list',
  label: 'List block',
  description: 'Slice, merge, count lists',
  operation: 'append',
  primarySample: [1, 2, 3],
  secondarySample: [4, 5],
  startSample: 0,
  endSample: 3,
  limit: 5,
  sort: 'asc'
});

const createObjectData = (): ObjectNodeData => ({
  kind: 'object',
  label: 'Object block',
  description: 'Merge and pick fields',
  operation: 'merge',
  sourceSample: { status: 'idle', attempts: 0 },
  patchSample: { status: 'ready' },
  selectedKeys: [],
  path: ''
});

const toFlowNodes = (nodes: LogicEditorNode[]): FlowNode[] =>
  nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: node.data,
    position: node.position
  }));

const toFlowEdges = (edges: LogicEditorEdge[]): FlowEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle
  }));

const serializeNodes = (nodes: FlowNode[]): LogicEditorNode[] =>
  nodes.map((node) => ({
    id: node.id,
    type: (node.type as LogicEditorNode['type']) ?? 'dummy',
    position: node.position,
    data: node.data
  }));

const serializeEdges = (edges: FlowEdge[]): LogicEditorEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined
  }));

const createPageNode = (page: PageDocument, position = { x: 0, y: 0 }): FlowNode => ({
  id: `page-${page.id}`,
  type: 'page',
  position,
  data: {
    kind: 'page',
    pageId: page.id,
    pageName: page.name,
    routeSegment: page.slug,
    inputs: page.dynamicInputs
  }
});

const createDummyNode = (position = { x: 0, y: 0 }): FlowNode => ({
  id: `dummy-${generateId()}`,
  type: 'dummy',
  position,
  data: createDummyData()
});

const createArithmeticFlowNode = (position = { x: 0, y: 0 }): FlowNode => ({
  id: `arithmetic-${generateId()}`,
  type: 'arithmetic',
  position,
  data: createArithmeticData()
});

const createStringFlowNode = (position = { x: 0, y: 0 }): FlowNode => ({
  id: `string-${generateId()}`,
  type: 'string',
  position,
  data: createStringData()
});

const createListFlowNode = (position = { x: 0, y: 0 }): FlowNode => ({
  id: `list-${generateId()}`,
  type: 'list',
  position,
  data: createListData()
});

const createObjectFlowNode = (position = { x: 0, y: 0 }): FlowNode => ({
  id: `object-${generateId()}`,
  type: 'object',
  position,
  data: createObjectData()
});

type StaticPaletteNode = Exclude<PaletteNodeType, 'page'>;

const staticNodeFactory: Record<StaticPaletteNode, (position?: { x: number; y: number }) => FlowNode> = {
  dummy: createDummyNode,
  arithmetic: createArithmeticFlowNode,
  string: createStringFlowNode,
  list: createListFlowNode,
  object: createObjectFlowNode
};

type PaletteNodeOptions = {
  name?: string;
  slug?: string;
};

const LogicEditorView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<LogicEditorNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const previewResolver = useMemo(() => createPreviewResolver(nodes, edges), [nodes, edges]);
  const pendingSaveRef = useRef<Promise<unknown> | null>(null);
  const deleteElements = useCallback(
    (elements: { nodes?: FlowNode[]; edges?: FlowEdge[] }) => {
      reactFlowInstance.deleteElements(elements);
    },
    [reactFlowInstance]
  );

  const deleteSelection = useDeleteNodesShortcut({
    selectedNodeIds,
    nodes,
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

  useEffect(() => {
    setFeedback('');
  }, [projectId]);

  useEffect(() => {
    setSelectedNodeIds((current) => {
      const next = current.filter((id) => nodes.some((node) => node.id === id));
      return next.length === current.length ? current : next;
    });
  }, [nodes]);

  const graphQuery = useQuery({
    queryKey: ['project-graph', projectId],
    queryFn: () => projectGraphApi.get(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (graphQuery.data?.graph) {
      setNodes(toFlowNodes(graphQuery.data.graph.nodes));
      setEdges(toFlowEdges(graphQuery.data.graph.edges));
      setHasUnsavedChanges(false);
      setTimeout(() => {
        try {
          reactFlowInstance.fitView({ padding: 0.4 });
        } catch (error) {
          // Ignore fitView failures in SSR or when instance not ready yet.
        }
      }, 50);
    }
  }, [graphQuery.data?.graph, reactFlowInstance, setEdges, setNodes]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProjectGraphSnapshot) => projectGraphApi.save(projectId!, payload),
    onSuccess: ({ graph }) => {
      logicLogger.info('Graph saved', { projectId, nodes: graph.nodes.length, edges: graph.edges.length });
      setNodes(toFlowNodes(graph.nodes));
      setEdges(toFlowEdges(graph.edges));
      setHasUnsavedChanges(false);
      setFeedback('Saved');
      setTimeout(() => setFeedback(''), 2000);
    },
    onError: (error: unknown) => {
      logicLogger.error('Graph save failed', {
        projectId,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      setFeedback(error instanceof Error ? error.message : 'Unable to save graph');
    }
  });

  const createPageMutation = useMutation({
    mutationFn: (payload: { name: string; slug?: string }) => projectPagesApi.create(projectId!, payload),
    onSuccess: (_, payload) => {
      logicLogger.debug('Pages invalidated after creation', { projectId, slug: payload.slug });
      queryClient.invalidateQueries({ queryKey: ['project-pages', projectId] });
    },
    onError: (error: unknown) => {
      logicLogger.error('Page create failed', { projectId, message: error instanceof Error ? error.message : 'Unknown error' });
      setFeedback(error instanceof Error ? error.message : 'Unable to create page');
    }
  });

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setHasUnsavedChanges(true);
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setHasUnsavedChanges(true);
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  const isHandleAvailable = useCallback(
    (connection: Partial<Connection>) => isTargetHandleFree(edges, connection),
    [edges]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isHandleAvailable(connection)) {
        logicLogger.warn('Connection rejected: handle already in use', {
          target: connection.target,
          targetHandle: connection.targetHandle
        });
        setFeedback('Input already connected. Remove existing link first.');
        return;
      }
      logicLogger.debug('Nodes connected', { source: connection.source, target: connection.target });
      setHasUnsavedChanges(true);
      setEdges((eds: FlowEdge[]) => addEdge({ ...connection, id: `${connection.source}-${connection.target}-${Date.now()}` }, eds));
    },
    [isHandleAvailable, setEdges]
  );

  const persistGraph = useCallback(
    async ({ reason, force = false }: { reason: string; force?: boolean }) => {
      if (!projectId) {
        return;
      }
      if (!force && !hasUnsavedChanges) {
        logicLogger.debug('Skipping graph persist — no changes', { reason, projectId });
        return;
      }
      const payload: ProjectGraphSnapshot = {
        nodes: serializeNodes(nodes),
        edges: serializeEdges(edges)
      };

      if (pendingSaveRef.current) {
        logicLogger.debug('Awaiting in-flight graph save', { reason, projectId });
        return pendingSaveRef.current;
      }

      logicLogger.info('Saving graph', { projectId, reason, nodes: payload.nodes.length, edges: payload.edges.length });
      const promise = saveMutation.mutateAsync(payload);
      pendingSaveRef.current = promise;
      try {
        await promise;
      } finally {
        pendingSaveRef.current = null;
      }
    },
    [edges, hasUnsavedChanges, nodes, projectId, saveMutation]
  );

  const handleSave = useCallback(() => {
    void persistGraph({ reason: 'manual', force: true });
  }, [persistGraph]);

  const handleAddNode = useCallback(
    async (type: PaletteNodeType, position?: { x: number; y: number }, options?: PaletteNodeOptions) => {
      if (!projectId) {
        return;
      }

      if (type !== 'page') {
        const factory = staticNodeFactory[type as StaticPaletteNode];
        if (!factory) {
          return;
        }
        const node = factory(position);
        logicLogger.info('Logic node added', { projectId, nodeId: node.id, type });
        setNodes((current: FlowNode[]) => current.concat(node));
        setHasUnsavedChanges(true);
        return;
      }

      const pageCount = nodes.filter((node: FlowNode) => node.type === 'page').length;
      const resolvedName = options?.name?.trim() || deriveDefaultPageName(pageCount);
      const resolvedSlug = normalizeRouteSegment(options?.slug ?? '', resolvedName);
      try {
        const { page } = await createPageMutation.mutateAsync({ name: resolvedName, slug: resolvedSlug });
        logicLogger.info('Page node created via API', { projectId, pageId: page.id, slug: page.slug });
        setNodes((current: FlowNode[]) => current.concat(createPageNode(page, position)));
        setHasUnsavedChanges(true);
      } catch (error) {
        logicLogger.error('Unable to create page node', { projectId, message: (error as Error).message });
        // Error already surfaced via mutation onError handler.
      }
    },
    [createPageMutation, nodes, projectId, setNodes]
  );

  const handlePaletteAdd = useCallback(
    (type: PaletteNodeType) => {
      void handleAddNode(type);
    },
    [handleAddNode]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as PaletteNodeType | undefined;
      if (!type) {
        return;
      }
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0)
      });
      handleAddNode(type, position);
    },
    [handleAddNode, reactFlowInstance]
  );

  const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: FlowNode[] }) => {
    setSelectedNodeIds(selected.map((node) => node.id));
  }, []);

  const isSaving = saveMutation.isPending || createPageMutation.isPending;
  const isLoading = graphQuery.isLoading || !projectId;

  const headerContent = useMemo(() => {
    if (!projectId) {
      return 'Select a project to begin.';
    }
    return `Project ${projectId}`;
  }, [projectId]);

  const handleNavigateToBuilder = useCallback(
    async (pageId: string) => {
      if (!projectId) {
        return;
      }
      try {
        await persistGraph({ reason: 'ui-builder-transition' });
        navigate(`/app/${projectId}/page/${pageId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save before navigating';
        logicLogger.error('Navigation blocked due to save failure', { projectId, pageId, message });
        setFeedback(message);
        setTimeout(() => setFeedback(''), 3000);
      }
    },
    [navigate, persistGraph, projectId]
  );

  if (!projectId) {
    return (
      <div className="p-8 text-white">
        <p>Project not found.</p>
        <button type="button" className="mt-4 underline" onClick={() => navigate('/workspace')}>
          Go back to workspace
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <LogicNodePalette onAddNode={handlePaletteAdd} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 bg-bw-ink/80 px-6 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Logic editor</p>
            <p className="text-lg font-semibold">{headerContent}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={deleteSelection}
              disabled={selectedNodeIds.length === 0}
              className="rounded-xl border border-white/20 px-4 py-2 text-bw-platinum transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete selection
            </button>
            {feedback && <span className="text-bw-platinum/70">{feedback}</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="rounded-xl bg-bw-sand px-4 py-2 font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save flow'}
            </button>
          </div>
        </header>
        <div className="relative flex-1">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bw-ink/80 text-sm text-bw-platinum/70">
              Loading graph…
            </div>
          )}
          {graphQuery.isError && !isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bw-ink/80 text-sm text-red-300">
              {(graphQuery.error as Error)?.message ?? 'Unable to load graph'}
            </div>
          )}
          <div ref={reactFlowWrapper} className="h-full">
            <PreviewResolverProvider resolver={previewResolver}>
              <LogicNavigationProvider value={{ openPageBuilder: handleNavigateToBuilder }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  isValidConnection={isHandleAvailable}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onSelectionChange={handleSelectionChange}
                  panOnDrag
                  panOnScroll
                  zoomOnScroll
                >
                  <MiniMap pannable zoomable className="!bg-bw-ink/80" />
                  <Controls />
                  <Background gap={16} color="#ffffff33" />
                </ReactFlow>
              </LogicNavigationProvider>
            </PreviewResolverProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProjectLogicPage = () => (
  <ReactFlowProvider>
    <LogicEditorView />
  </ReactFlowProvider>
);

export { createPageNode, createDummyNode, serializeNodes, serializeEdges };

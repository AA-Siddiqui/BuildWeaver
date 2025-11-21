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
  DummyNodeData,
  LogicEditorEdge,
  LogicEditorNode,
  LogicEditorNodeData,
  PageDocument,
  ProjectGraphSnapshot
} from '../types/api';
import { projectGraphApi, projectPagesApi } from '../lib/api-client';
import { LogicNodePalette, PaletteNodeType } from '../components/logic/LogicNodePalette';
import { DummyNode } from '../components/logic/DummyNode';
import { PageNode } from '../components/logic/PageNode';

const nodeTypes = {
  dummy: DummyNode,
  page: PageNode
};

type FlowNode = Node<LogicEditorNodeData>;
type FlowEdge = Edge;

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const DEFAULT_DUMMY_DATA: DummyNodeData = {
  kind: 'dummy',
  label: 'Dummy',
  value: 42,
  description: 'Placeholder output'
};

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
  data: DEFAULT_DUMMY_DATA
});

const LogicEditorView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<LogicEditorNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setFeedback('');
  }, [projectId]);

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
      setNodes(toFlowNodes(graph.nodes));
      setEdges(toFlowEdges(graph.edges));
      setHasUnsavedChanges(false);
      setFeedback('Saved');
      setTimeout(() => setFeedback(''), 2000);
    },
    onError: (error: unknown) => {
      setFeedback(error instanceof Error ? error.message : 'Unable to save graph');
    }
  });

  const createPageMutation = useMutation({
    mutationFn: (name: string) => projectPagesApi.create(projectId!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pages', projectId] });
    },
    onError: (error: unknown) => {
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

  const handleConnect = useCallback(
    (connection: Connection) => {
      setHasUnsavedChanges(true);
      setEdges((eds: FlowEdge[]) => addEdge({ ...connection, id: `${connection.source}-${connection.target}-${Date.now()}` }, eds));
    },
    [setEdges]
  );

  const handleSave = useCallback(() => {
    if (!projectId) {
      return;
    }
    const payload: ProjectGraphSnapshot = {
      nodes: serializeNodes(nodes),
      edges: serializeEdges(edges)
    };
    saveMutation.mutate(payload);
  }, [edges, nodes, projectId, saveMutation]);

  const handleAddNode = useCallback(
    async (type: PaletteNodeType, position?: { x: number; y: number }) => {
      if (!projectId) {
        return;
      }

      if (type === 'dummy') {
        setNodes((current: FlowNode[]) => current.concat(createDummyNode(position)));
        setHasUnsavedChanges(true);
        return;
      }

      const defaultName = `Page ${nodes.filter((node: FlowNode) => node.type === 'page').length + 1}`;
      try {
        const { page } = await createPageMutation.mutateAsync(defaultName);
        setNodes((current: FlowNode[]) => current.concat(createPageNode(page, position)));
        setHasUnsavedChanges(true);
      } catch (error) {
        // Error already surfaced via mutation onError handler.
      }
    },
    [createPageMutation, nodes, projectId, setNodes]
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

  const isSaving = saveMutation.isPending || createPageMutation.isPending;
  const isLoading = graphQuery.isLoading || !projectId;

  const headerContent = useMemo(() => {
    if (!projectId) {
      return 'Select a project to begin.';
    }
    return `Project ${projectId}`;
  }, [projectId]);

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
      <LogicNodePalette onAddNode={handleAddNode} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 bg-bw-ink/80 px-6 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Logic editor</p>
            <p className="text-lg font-semibold">{headerContent}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
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
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              panOnDrag
              panOnScroll
              zoomOnScroll
            >
              <MiniMap pannable zoomable className="!bg-bw-ink/80" />
              <Controls />
              <Background gap={16} color="#ffffff33" />
            </ReactFlow>
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

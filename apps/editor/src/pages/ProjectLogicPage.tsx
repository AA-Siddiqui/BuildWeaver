import {
  Background,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  MiniMap,
  NodeChange,
  ReactFlow,
  ReactFlowProvider,
  XYPosition,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  DatabaseSchema,
  DatabaseNodeData,
  DatabaseTable,
  DatabaseField,
  DatabaseRelationship,
  DatabaseConnectionSettings,
  FunctionNodeData,
  LogicEditorNode,
  LogicEditorNodeData,
  PageDocument,
  PageNodeData,
  ProjectGraphSnapshot,
  UserDefinedFunction
} from '../types/api';
import { projectDatabasesApi, projectGraphApi, projectPagesApi } from '../lib/api-client';
import { LogicNodePalette, FUNCTION_DRAG_DATA } from '../components/logic/LogicNodePalette';
import { DummyNode } from '../components/logic/DummyNode';
import { PageNode } from '../components/logic/PageNode';
import { ArithmeticNode } from '../components/logic/ArithmeticNode';
import { StringNode } from '../components/logic/StringNode';
import { ListNode } from '../components/logic/ListNode';
import { ObjectNode } from '../components/logic/ObjectNode';
import { ConditionalNode } from '../components/logic/ConditionalNode';
import { LogicalOperatorNode } from '../components/logic/LogicalOperatorNode';
import { RelationalOperatorNode } from '../components/logic/RelationalOperatorNode';
import { PreviewResolverProvider, createPreviewResolver } from '../components/logic/previewResolver';
import { SeverableEdge } from '../components/logic/SeverableEdge';
import { logicLogger } from '../lib/logger';
import { projectGraphQueryKey, invalidateProjectGraphCache } from '../lib/query-helpers';
import { SnapshotHistory } from '../lib/snapshotHistory';
import { processEditorShortcut } from '../lib/editorShortcuts';
import { useDeleteNodesShortcut } from '../hooks/useDeleteNodesShortcut';
import { useNodePaletteVisibility } from '../hooks/useNodePaletteVisibility';
import { LogicNavigationProvider } from '../components/logic/LogicNavigationContext';
import { PageRouteRegistryProvider } from '../components/logic/PageRouteRegistryContext';
import { deriveDefaultPageName, normalizeRouteSegment } from '../lib/routes';
import {
  FlowEdge,
  FlowNode,
  serializeEdges,
  serializeNodes,
  toFlowEdges,
  toFlowNodes
} from '../components/logic/graphSerialization';
import {
  PaletteNodeType,
  createFunctionReferenceNode,
  createPageNode,
  generateNodeId,
  staticNodeFactory
} from '../components/logic/nodeFactories';
import { FunctionNode } from '../components/logic/function/FunctionNode';
import { FunctionArgumentNode } from '../components/logic/function/FunctionArgumentNode';
import { FunctionReturnNode } from '../components/logic/function/FunctionReturnNode';
import { FunctionEditorModal } from '../components/logic/function/FunctionEditorModal';
import { FunctionRegistryProvider } from '../components/logic/function/FunctionRegistryContext';
import { DatabaseDesignerModal } from '../components/db-designer/DatabaseDesignerModal';
import { DatabaseNode } from '../components/logic/DatabaseNode';
import { LogicEdgeActionsProvider, SeverEdgeReason } from '../components/logic/LogicEdgeActionsContext';
import {
  buildNodePositionMap,
  createRectFromPoints,
  findEdgesIntersectingSegment,
  getNodesWithinRect
} from '../lib/graphInteractions';
import { cloneGraphSnapshot, GraphSnapshot, hashGraphSnapshot } from '../lib/graphSnapshot';
import { DragHistoryBuffer } from '../lib/dragHistoryBuffer';

const nodeTypes = {
  dummy: DummyNode,
  page: PageNode,
  arithmetic: ArithmeticNode,
  string: StringNode,
  list: ListNode,
  object: ObjectNode,
  conditional: ConditionalNode,
  logical: LogicalOperatorNode,
  relational: RelationalOperatorNode,
  function: FunctionNode,
  'function-argument': FunctionArgumentNode,
  'function-return': FunctionReturnNode,
  database: DatabaseNode
};

const edgeTypes = {
  severable: SeverableEdge
};

const GRAPH_HISTORY_LIMIT = 150;

export const isTargetHandleFree = (edges: Edge[], connection: Partial<Connection>): boolean => {
  if (!connection.target || !connection.targetHandle) {
    return true;
  }
  return !edges.some(
    (edge) => edge.target === connection.target && edge.targetHandle === connection.targetHandle
  );
};
type PaletteNodeOptions = {
  name?: string;
  slug?: string;
};

type StaticPaletteNodeType = Exclude<PaletteNodeType, 'page'>;

const isStaticPaletteNodeType = (value: PaletteNodeType): value is StaticPaletteNodeType => value !== 'page';

const ensureSeverableEdges = (incoming: FlowEdge[]): FlowEdge[] =>
  incoming.map((edge) => (edge.type === 'severable' ? edge : { ...edge, type: 'severable' }));

type ScreenPoint = { x: number; y: number };

type GestureState = {
  startFlow: XYPosition;
  currentFlow: XYPosition;
  startScreen: ScreenPoint;
  currentScreen: ScreenPoint;
};

type InteractionMode = 'cut' | 'marquee';

const MIN_GESTURE_DISTANCE = 6;

const gestureDistance = (gesture: GestureState): number =>
  Math.hypot(gesture.currentFlow.x - gesture.startFlow.x, gesture.currentFlow.y - gesture.startFlow.y);

const isPaneTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && Boolean(target.closest('.react-flow__pane'));

const createDefaultDbConnection = () => ({
  host: 'localhost',
  port: 5432,
  database: '',
  user: '',
  password: '',
  ssl: false
});

const normalizeDatabaseFields = (fields: DatabaseField[] = [], tableId: string): DatabaseField[] => {
  const normalized = fields.map((field: DatabaseField) => ({
    ...field,
    name: field.name?.trim() || 'id',
    type: field.type ?? 'uuid',
    nullable: Boolean(field.nullable),
    unique: Boolean(field.unique),
    defaultValue: field.defaultValue ?? undefined,
    isId: Boolean(field.isId)
  }));
  const hasId = normalized.some((field) => field.isId);
  const ensured = hasId
    ? normalized.map((field) => (field.isId ? { ...field, nullable: false, unique: true } : field))
    : [
        {
          id: `${tableId}-id`,
          name: 'id',
          type: 'uuid',
          nullable: false,
          unique: true,
          isId: true
        } satisfies DatabaseField,
        ...normalized
      ];
  return ensured;
};

const normalizeDatabaseSchema = (schema: DatabaseSchema): DatabaseSchema => {
  const tables = (schema.tables ?? []).map((table: DatabaseTable, index: number) => {
    const tableId = table.id || `table-${generateNodeId()}`;
    return {
      ...table,
      id: tableId,
      name: table.name?.trim() || `Table ${index + 1}`,
      fields: normalizeDatabaseFields(table.fields ?? [], tableId),
      position: table.position ?? { x: 140 * index, y: 80 * index }
    };
  });
  const tableIds = new Set(tables.map((table) => table.id));
  const relationships = (schema.relationships ?? [])
    .filter((relationship: DatabaseRelationship) => tableIds.has(relationship.sourceTableId) && tableIds.has(relationship.targetTableId))
    .map((relationship: DatabaseRelationship): DatabaseRelationship => ({
      ...relationship,
      cardinality: relationship.cardinality === 'one' ? 'one' : 'many',
      modality: relationship.modality === 1 ? 1 : 0
    }));

  return {
    ...schema,
    name: schema.name?.trim() || 'Database',
    tables,
    relationships,
    connection: schema.connection ? { ...createDefaultDbConnection(), ...schema.connection } : createDefaultDbConnection(),
    updatedAt: schema.updatedAt ?? new Date().toISOString()
  };
};

const createEmptyDatabaseSchema = (name: string): DatabaseSchema =>
  normalizeDatabaseSchema({
    id: `db-${generateNodeId()}`,
    name,
    tables: [],
    relationships: [],
    connection: createDefaultDbConnection()
  });

const toDatabaseNodeData = (schema: DatabaseSchema): DatabaseNodeData => {
  const normalized = normalizeDatabaseSchema(schema);
  return {
    kind: 'database',
    schemaId: normalized.id,
    schemaName: normalized.name,
    tables: normalized.tables.map(({ id, name, fields }: DatabaseTable) => ({ id, name, fields }))
  };
};

const serializeDatabases = (schemas: DatabaseSchema[]): DatabaseSchema[] =>
  (schemas ?? []).map((schema: DatabaseSchema) => normalizeDatabaseSchema(schema));

const LogicEditorView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<LogicEditorNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [functions, setFunctions] = useState<UserDefinedFunction[]>([]);
  const [activeFunction, setActiveFunction] = useState<UserDefinedFunction | null>(null);
  const [databases, setDatabases] = useState<DatabaseSchema[]>([]);
  const [activeDatabaseSchema, setActiveDatabaseSchema] = useState<DatabaseSchema | null>(null);
  const [isDatabaseDesignerOpen, setIsDatabaseDesignerOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [edgeCutGesture, setEdgeCutGesture] = useState<GestureState | null>(null);
  const [marqueeGesture, setMarqueeGesture] = useState<GestureState | null>(null);
  const previewResolver = useMemo(
    () => createPreviewResolver(nodes, edges, { functions }),
    [nodes, edges, functions]
  );
  const connectionLineStyle = useMemo(() => ({ stroke: '#F9E7B2', strokeWidth: 2 }), []);
  const pendingSaveRef = useRef<Promise<unknown> | null>(null);
  const interactionRef = useRef<{ mode: InteractionMode; pointerId: number } | null>(null);
  const edgeCutGestureRef = useRef<GestureState | null>(null);
  const marqueeGestureRef = useRef<GestureState | null>(null);
  const edgesRef = useRef<FlowEdge[]>(edges);
  const graphHistoryRef = useRef(
    new SnapshotHistory<GraphSnapshot>({
      clone: cloneGraphSnapshot,
      hash: hashGraphSnapshot,
      limit: GRAPH_HISTORY_LIMIT,
      logger: (message, meta) => logicLogger.debug(message, meta)
    })
  );
  const nodeDragHistoryRef = useRef(new DragHistoryBuffer<GraphSnapshot>());
  const pendingDragFlushRef = useRef(false);
  const { isVisible: isNodePaletteVisible, toggle: toggleNodePaletteVisibility } = useNodePaletteVisibility({
    projectId,
    initialVisible: true
  });

  const flushDragSnapshot = useCallback(() => {
    nodeDragHistoryRef.current.end((snapshot, context) => {
      graphHistoryRef.current.observe(snapshot, {
        projectId,
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        functions: snapshot.functions.length,
        databases: snapshot.databases.length,
        reason: context.reason,
        nodeIds: context.nodeIds
      });
    });
  }, [projectId]);

  const deleteElements = useCallback(
    (elements: { nodes?: FlowNode[]; edges?: FlowEdge[] }) => {
      reactFlowInstance.deleteElements(elements);
    },
    [reactFlowInstance]
  );

  useLayoutEffect(() => {
    const snapshot = cloneGraphSnapshot({ nodes, edges, functions, databases });
    if (nodeDragHistoryRef.current.isActive()) {
      nodeDragHistoryRef.current.capture(snapshot);
      if (pendingDragFlushRef.current) {
        pendingDragFlushRef.current = false;
        flushDragSnapshot();
      }
      return;
    }
    graphHistoryRef.current.observe(snapshot, {
      projectId,
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      functions: snapshot.functions.length,
      databases: snapshot.databases.length,
      reason: 'state-observer'
    });
  }, [databases, edges, flushDragSnapshot, functions, nodes, projectId]);

  const resetGraphHistory = useCallback(
    (snapshot: GraphSnapshot, context: string) => {
      nodeDragHistoryRef.current.reset();
      pendingDragFlushRef.current = false;
      graphHistoryRef.current.reset(snapshot, { projectId, context });
    },
    [projectId]
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

  const severEdges = useCallback(
    (edgeIds: string[], metadata: { reason: SeverEdgeReason }) => {
      if (!edgeIds.length) {
        logicLogger.debug('Edge sever requested without targets', { projectId, reason: metadata.reason });
        return;
      }
      setEdges((current: FlowEdge[]) => current.filter((edge) => !edgeIds.includes(edge.id)));
      setHasUnsavedChanges(true);
      setFeedback(`Removed ${edgeIds.length} connection${edgeIds.length > 1 ? 's' : ''}`);
      setTimeout(() => setFeedback(''), 2000);
      logicLogger.info('Connections severed', {
        projectId,
        count: edgeIds.length,
        reason: metadata.reason
      });
    },
    [projectId, setEdges]
  );

  useEffect(() => {
    setFeedback('');
  }, [projectId]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    edgeCutGestureRef.current = edgeCutGesture;
  }, [edgeCutGesture]);

  useEffect(() => {
    marqueeGestureRef.current = marqueeGesture;
  }, [marqueeGesture]);

  useEffect(() => {
    setSelectedNodeIds((current) => {
      const next = current.filter((id) => nodes.some((node) => node.id === id));
      return next.length === current.length ? current : next;
    });
  }, [nodes]);

  useEffect(() => {
    if (!activeFunction) {
      return;
    }
    const refreshed = functions.find((fn) => fn.id === activeFunction.id);
    if (!refreshed) {
      setActiveFunction(null);
      return;
    }
    if (refreshed.updatedAt !== activeFunction.updatedAt) {
      setActiveFunction(refreshed);
    }
  }, [activeFunction, functions]);

  const graphQuery = useQuery({
    queryKey: projectGraphQueryKey(projectId ?? 'logic'),
    queryFn: () => projectGraphApi.get(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000
  });

  const pagesQuery = useQuery({
    queryKey: ['project-pages', projectId],
    queryFn: () => projectPagesApi.list(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000
  });

  useEffect(() => {
    if (pagesQuery.isSuccess) {
      logicLogger.debug('Project pages hydrated for logic editor', {
        projectId,
        pages: pagesQuery.data.pages.length
      });
    }
  }, [pagesQuery.data?.pages.length, pagesQuery.isSuccess, projectId]);

  useEffect(() => {
    if (pagesQuery.isError) {
      const message = pagesQuery.error instanceof Error ? pagesQuery.error.message : 'Unknown error';
      logicLogger.error('Failed to load project pages for logic editor', { projectId, message });
    }
  }, [pagesQuery.error, pagesQuery.isError, projectId]);

  const pageRouteSummary = useMemo(
    () => collectPageRoutes(nodes, pagesQuery.data?.pages ?? []),
    [nodes, pagesQuery.data?.pages]
  );

  const knownPageRoutes = pageRouteSummary.routes;

  const isRouteAvailable = useCallback(
    (candidate?: string, currentPageId?: string) => {
      const normalized = normalizeRouteSegment(candidate ?? '');
      if (!normalized) {
        return false;
      }
      const owners = pageRouteSummary.ownership[normalized];
      if (!owners || owners.length === 0) {
        return true;
      }
      if (currentPageId) {
        return owners.every((ownerId) => ownerId === currentPageId);
      }
      return false;
    },
    [pageRouteSummary]
  );

  const pageRouteRegistryValue = useMemo(
    () => ({
      routes: knownPageRoutes,
      isRouteAvailable
    }),
    [isRouteAvailable, knownPageRoutes]
  );

  const pageRoutesErrorMessage = pagesQuery.isError
    ? pagesQuery.error instanceof Error
      ? pagesQuery.error.message
      : 'Unable to load page routes'
    : '';

  useEffect(() => {
    if (graphQuery.data?.graph) {
      const hydratedNodes = toFlowNodes(graphQuery.data.graph.nodes);
      const hydratedEdges = ensureSeverableEdges(toFlowEdges(graphQuery.data.graph.edges));
      const hydratedFunctions = graphQuery.data.graph.functions ?? [];
      const hydratedDatabases = serializeDatabases(graphQuery.data.graph.databases ?? []);
      setNodes(hydratedNodes);
      setEdges(hydratedEdges);
      setFunctions(hydratedFunctions);
      setDatabases(hydratedDatabases);
      setHasUnsavedChanges(false);
      nodeDragHistoryRef.current.reset();
      pendingDragFlushRef.current = false;
      resetGraphHistory(
        { nodes: hydratedNodes, edges: hydratedEdges, functions: hydratedFunctions, databases: hydratedDatabases },
        'hydrate'
      );
      setTimeout(() => {
        try {
          reactFlowInstance.fitView({ padding: 0.4 });
        } catch (error) {
          // Ignore fitView failures in SSR or when instance not ready yet.
        }
      }, 50);
    }
  }, [graphQuery.data?.graph, reactFlowInstance, resetGraphHistory, setDatabases, setEdges, setNodes, setFunctions]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProjectGraphSnapshot) => projectGraphApi.save(projectId!, payload),
    onSuccess: ({ graph }) => {
      logicLogger.info('Graph saved', {
        projectId,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        databases: graph.databases?.length ?? 0
      });
      setNodes(toFlowNodes(graph.nodes));
      setEdges(ensureSeverableEdges(toFlowEdges(graph.edges)));
      setFunctions(graph.functions ?? []);
      setDatabases(serializeDatabases(graph.databases ?? []));
      setHasUnsavedChanges(false);
      setFeedback('Saved');
      setTimeout(() => setFeedback(''), 2000);
      void invalidateProjectGraphCache(
        queryClient,
        projectId,
        { reason: 'logic-save' },
        (message, details) => logicLogger.debug(message, details)
      );
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
      const positionChanges = changes.filter((change) => change.type === 'position');
      if (positionChanges.length) {
        const nodeIds = Array.from(new Set(positionChanges.map((change) => change.id)));
        const dragStart = positionChanges.some((change) => change.dragging === true);
        const dragEnd = positionChanges.some((change) => change.dragging === false);
        if (dragStart && !nodeDragHistoryRef.current.isActive()) {
          nodeDragHistoryRef.current.begin({ reason: 'node-drag', nodeIds });
          pendingDragFlushRef.current = false;
          logicLogger.debug('Node drag session started', { projectId, nodeIds });
        }
        if (dragEnd) {
          pendingDragFlushRef.current = true;
          logicLogger.debug('Node drag session ended', { projectId, nodeIds });
        }
      }
      setHasUnsavedChanges(true);
      onNodesChange(changes);
    },
    [onNodesChange, projectId]
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
      setEdges((eds: FlowEdge[]) =>
        ensureSeverableEdges(
          addEdge(
            { ...connection, id: `${connection.source}-${connection.target}-${Date.now()}`, type: 'severable' },
            eds
          )
        )
      );
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
      const normalizedFunctions = functions.map((fn) => {
        const { updatedAt, ...persistable } = fn;
        return updatedAt ? { ...persistable } : persistable;
      });
      const strippedCount = functions.filter((fn) => typeof fn.updatedAt !== 'undefined').length;
      if (strippedCount > 0) {
        logicLogger.debug('Stripped transient metadata from functions before save', {
          projectId,
          stripped: strippedCount
        });
      }
      const payload: ProjectGraphSnapshot = {
        nodes: serializeNodes(nodes),
        edges: serializeEdges(edges),
        functions: normalizedFunctions,
        databases: serializeDatabases(databases)
      };
      const inputSummary = summarizePageNodeInputs(payload.nodes);
      if (inputSummary) {
        logicLogger.debug('Graph payload page input summary', {
          projectId,
          pageNodes: inputSummary.pageNodes,
          inputCounts: inputSummary.inputCounts
        });
        if (inputSummary.missingListMetadata.length) {
          logicLogger.warn('Graph payload list inputs missing metadata', {
            projectId,
            missing: inputSummary.missingListMetadata.slice(0, 5)
          });
        }
      }

      if (pendingSaveRef.current) {
        logicLogger.debug('Awaiting in-flight graph save', { reason, projectId });
        return pendingSaveRef.current;
      }

      logicLogger.info('Saving graph', {
        projectId,
        reason,
        nodes: payload.nodes.length,
        edges: payload.edges.length,
        databases: payload.databases?.length ?? 0
      });
      const promise = saveMutation.mutateAsync(payload);
      pendingSaveRef.current = promise;
      try {
        await promise;
      } finally {
        pendingSaveRef.current = null;
      }
    },
    [databases, edges, functions, hasUnsavedChanges, nodes, projectId, saveMutation]
  );

  const handleSave = useCallback(() => {
    void persistGraph({ reason: 'manual', force: true });
  }, [persistGraph]);

  const restoreGraphSnapshot = useCallback(
    (snapshot: GraphSnapshot, action: 'undo' | 'redo') => {
      nodeDragHistoryRef.current.reset();
      pendingDragFlushRef.current = false;
      graphHistoryRef.current.suppressNextDiff();
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setFunctions(snapshot.functions);
      setDatabases(snapshot.databases);
      setHasUnsavedChanges(true);
      setFeedback(action === 'undo' ? 'Undid change' : 'Redid change');
      setTimeout(() => setFeedback(''), 2000);
      logicLogger.info(`Graph ${action} applied`, {
        projectId,
        undoDepth: graphHistoryRef.current.getUndoDepth(),
        redoDepth: graphHistoryRef.current.getRedoDepth(),
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        databases: snapshot.databases.length
      });
    },
    [projectId, setDatabases, setEdges, setFunctions, setNodes]
  );

  const handleUndoAction = useCallback(() => {
    const snapshot = graphHistoryRef.current.undo({ nodes, edges, functions, databases });
    if (!snapshot) {
      logicLogger.debug('Undo ignored — no history', { projectId });
      return;
    }
    restoreGraphSnapshot(snapshot, 'undo');
  }, [databases, edges, functions, nodes, projectId, restoreGraphSnapshot]);

  const handleRedoAction = useCallback(() => {
    const snapshot = graphHistoryRef.current.redo({ nodes, edges, functions, databases });
    if (!snapshot) {
      logicLogger.debug('Redo ignored — no future history', { projectId });
      return;
    }
    restoreGraphSnapshot(snapshot, 'redo');
  }, [databases, edges, functions, nodes, projectId, restoreGraphSnapshot]);

  const syncDatabaseNodesWithSchema = useCallback(
    (schema: DatabaseSchema, options?: { createIfMissing?: boolean }) => {
      const nodeData = toDatabaseNodeData(schema);
      setNodes((current: FlowNode[]) => {
        let refreshed = 0;
        const updated = current.map((node) => {
          if (node.type !== 'database') {
            return node;
          }
          const existingData = node.data as Partial<DatabaseNodeData> | undefined;
          if (existingData?.schemaId !== schema.id) {
            return node;
          }
          const selectedTableId = existingData.selectedTableId && nodeData.tables.some((table) => table.id === existingData.selectedTableId)
            ? existingData.selectedTableId
            : nodeData.tables[0]?.id;
          refreshed += 1;
          return { ...node, data: { ...nodeData, selectedTableId } };
        });

        const hasNode = updated.some((node) => node.type === 'database' && (node.data as DatabaseNodeData | undefined)?.schemaId === schema.id);
        if (!hasNode && options?.createIfMissing) {
          const newNode: FlowNode = {
            id: `database-${generateNodeId()}`,
            type: 'database',
            position: { x: 0, y: 0 },
            data: nodeData
          };
          logicLogger.info('Database node created for schema', {
            projectId,
            schemaId: schema.id,
            tableCount: nodeData.tables.length,
            nodeId: newNode.id
          });
          return updated.concat(newNode);
        }
        if (refreshed > 0) {
          logicLogger.debug('Database node data refreshed', {
            projectId,
            schemaId: schema.id,
            updatedCount: refreshed
          });
        }
        return updated;
      });
    },
    [projectId, setNodes]
  );

  const handleDatabaseSave = useCallback(
    async (schema: DatabaseSchema) => {
      const normalized = normalizeDatabaseSchema(schema);
      setDatabases((current) => {
        const exists = current.some((entry) => entry.id === normalized.id);
        return exists ? current.map((entry) => (entry.id === normalized.id ? normalized : entry)) : current.concat(normalized);
      });
      syncDatabaseNodesWithSchema(normalized, { createIfMissing: true });
      setHasUnsavedChanges(true);
      logicLogger.info('Database schema saved in logic editor', {
        projectId,
        schemaId: normalized.id,
        tableCount: normalized.tables.length
      });
      setFeedback(`${normalized.name} saved`);
      setTimeout(() => setFeedback(''), 2000);
    },
    [projectId, setDatabases, setHasUnsavedChanges, syncDatabaseNodesWithSchema]
  );

  const handleDatabaseApply = useCallback(
    async (schema: DatabaseSchema) => {
      if (!projectId) {
        logicLogger.error('Database apply aborted - missing project id');
        setFeedback('Missing project context.');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      const normalized = normalizeDatabaseSchema(schema);
      logicLogger.info('Database apply requested', {
        projectId,
        schemaId: normalized.id,
        connectionHost: normalized.connection?.host,
        database: normalized.connection?.database
      });
      setFeedback('Applying database schema…');
      try {
        const response = await projectDatabasesApi.apply(projectId, normalized);
        setDatabases((current) => {
          const exists = current.some((entry) => entry.id === normalized.id);
          return exists ? current.map((entry) => (entry.id === normalized.id ? normalized : entry)) : current.concat(normalized);
        });
        syncDatabaseNodesWithSchema(normalized, { createIfMissing: true });
        setHasUnsavedChanges(true);
        logicLogger.info('Database schema apply completed', {
          projectId,
          schemaId: normalized.id,
          statements: response.statements.length
        });
        setFeedback('Database applied to Postgres');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to apply database schema';
        setFeedback(message);
        logicLogger.error('Database apply failed', {
          projectId,
          schemaId: normalized.id,
          message
        });
      } finally {
        setTimeout(() => setFeedback(''), 3000);
      }
    },
    [projectId, setDatabases, setHasUnsavedChanges, syncDatabaseNodesWithSchema]
  );

  const handleDatabaseIntrospect = useCallback(
    async (connection: DatabaseConnectionSettings, schema: DatabaseSchema) => {
      if (!projectId) {
        const message = 'Missing project context.';
        logicLogger.error('Database introspection aborted - missing project id');
        throw new Error(message);
      }
      const normalized = normalizeDatabaseSchema(schema);
      logicLogger.info('Database schema introspection requested', {
        projectId,
        schemaId: normalized.id,
        host: connection.host,
        database: connection.database
      });
      try {
        const response = await projectDatabasesApi.introspect(projectId, {
          connection,
          name: normalized.name,
          schemaId: normalized.id
        });
        const remoteSchema = normalizeDatabaseSchema({ ...response.schema, connection });
        setDatabases((current) => {
          const exists = current.some((entry) => entry.id === remoteSchema.id);
          return exists ? current.map((entry) => (entry.id === remoteSchema.id ? remoteSchema : entry)) : current.concat(remoteSchema);
        });
        syncDatabaseNodesWithSchema(remoteSchema, { createIfMissing: true });
        setHasUnsavedChanges(true);
        setActiveDatabaseSchema(remoteSchema);
        logicLogger.info('Database schema introspection completed', {
          projectId,
          schemaId: remoteSchema.id,
          tableCount: remoteSchema.tables.length,
          relationshipCount: remoteSchema.relationships.length
        });
        return remoteSchema;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load schema from database';
        logicLogger.error('Database introspection failed', {
          projectId,
          schemaId: normalized.id,
          message
        });
        throw new Error(message);
      }
    },
    [projectId, setDatabases, setHasUnsavedChanges, syncDatabaseNodesWithSchema]
  );

  const handleOpenDatabaseDesigner = useCallback(() => {
    const proposedName = window.prompt('Name your database schema', `Database ${databases.length + 1}`);
    if (!proposedName) {
      logicLogger.info('Database designer launch cancelled - missing name', { projectId });
      return;
    }
    const schema = createEmptyDatabaseSchema(proposedName);
    setActiveDatabaseSchema(schema);
    setIsDatabaseDesignerOpen(true);
    logicLogger.info('Database designer opened', { projectId, schemaId: schema.id });
  }, [databases.length, projectId]);

  const handleEditDatabaseSchema = useCallback(
    (schemaId: string) => {
      const existing = databases.find((schema) => schema.id === schemaId);
      if (!existing) {
        setFeedback('Database schema not found');
        setTimeout(() => setFeedback(''), 2000);
        return;
      }
      const normalized = normalizeDatabaseSchema(existing);
      setActiveDatabaseSchema(normalized);
      setIsDatabaseDesignerOpen(true);
      logicLogger.info('Database designer opened for editing', { projectId, schemaId });
    },
    [databases, projectId]
  );

  const handleCloseDatabaseDesigner = useCallback(() => {
    setActiveDatabaseSchema(null);
    setIsDatabaseDesignerOpen(false);
  }, []);

  const handleAddNode = useCallback(
    async (type: PaletteNodeType, position?: { x: number; y: number }, options?: PaletteNodeOptions) => {
      if (!projectId) {
        return;
      }

      if (isStaticPaletteNodeType(type)) {
        const factory = staticNodeFactory[type];
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
      if (!isRouteAvailable(resolvedSlug)) {
        const message = `Route /${resolvedSlug} already exists`;
        setFeedback(message);
        setTimeout(() => setFeedback(''), 3000);
        logicLogger.warn('Page creation blocked due to duplicate route', {
          projectId,
          route: resolvedSlug,
          knownRoutes: knownPageRoutes.length
        });
        return;
      }
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
    [createPageMutation, isRouteAvailable, knownPageRoutes, nodes, projectId, setNodes]
  );

  const handleAddFunctionNode = useCallback(
    (functionId: string, position?: { x: number; y: number }) => {
      const target = functions.find((fn) => fn.id === functionId);
      if (!target) {
        setFeedback('Function not found');
        setTimeout(() => setFeedback(''), 2000);
        logicLogger.warn('Attempted to add missing function node', { projectId, functionId });
        return;
      }
      const node = createFunctionReferenceNode(functionId, target.name, target.returnsValue ?? false, position);
      logicLogger.info('Function node added', { projectId, functionId, nodeId: node.id });
      setNodes((current: FlowNode[]) => current.concat(node));
      setHasUnsavedChanges(true);
    },
    [functions, projectId, setNodes]
  );

  const handleCreateFunction = useCallback(() => {
    const newFunction: UserDefinedFunction = {
      id: `fn-${generateNodeId()}`,
      name: `Function ${functions.length + 1}`,
      description: '',
      nodes: [],
      edges: [],
      arguments: [],
      returnsValue: false,
      updatedAt: new Date().toISOString()
    };
    logicLogger.info('User function created', { projectId, functionId: newFunction.id });
    setFunctions((current) => current.concat(newFunction));
    setActiveFunction(newFunction);
    setHasUnsavedChanges(true);
  }, [functions.length, projectId]);

  const handleEditFunction = useCallback(
    (functionId: string) => {
      const target = functions.find((fn) => fn.id === functionId);
      if (!target) {
        setFeedback('Function not found');
        setTimeout(() => setFeedback(''), 2000);
        logicLogger.warn('Function edit requested but not found', { projectId, functionId });
        return;
      }
      logicLogger.debug('Opening function editor', { projectId, functionId });
      setActiveFunction(target);
    },
    [functions, projectId]
  );

  const handleDeleteFunction = useCallback(
    (functionId: string) => {
      setFunctions((current) =>
        current
          .filter((fn) => fn.id !== functionId)
          .map((fn) => {
            let mutated = false;
            const filteredNodes = fn.nodes.filter((node) => {
              if (node.type !== 'function') {
                return true;
              }
              const data = node.data as FunctionNodeData;
              if (data.functionId === functionId) {
                mutated = true;
                return false;
              }
              return true;
            });
            if (!mutated) {
              return fn;
            }
            const nodeIds = new Set(filteredNodes.map((node) => node.id));
            return {
              ...fn,
              nodes: filteredNodes,
              edges: fn.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
            };
          })
      );
      setNodes((current: FlowNode[]) => {
        const removedIds = new Set(
          current
            .filter((node) => node.type === 'function' && (node.data as FunctionNodeData).functionId === functionId)
            .map((node) => node.id)
        );
        if (removedIds.size === 0) {
          return current;
        }
        setEdges((edgesState) => edgesState.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)));
        return current.filter((node) => !removedIds.has(node.id));
      });
      if (activeFunction?.id === functionId) {
        setActiveFunction(null);
      }
      setHasUnsavedChanges(true);
      logicLogger.warn('User function deleted', { projectId, functionId });
    },
    [activeFunction?.id, projectId, setEdges]
  );

  const handleFunctionSave = useCallback(
    (updatedFunction: UserDefinedFunction) => {
      setFunctions((current) =>
        current.map((fn) => {
          if (fn.id === updatedFunction.id) {
            return updatedFunction;
          }
          let mutated = false;
          const updatedNodes = fn.nodes.map((node) => {
            if (node.type !== 'function') {
              return node;
            }
            const data = node.data as FunctionNodeData;
            if (
              data.functionId !== updatedFunction.id ||
              (data.functionName === updatedFunction.name && data.returnsValue === updatedFunction.returnsValue)
            ) {
              return node;
            }
            mutated = true;
            return {
              ...node,
              data: { ...data, functionName: updatedFunction.name, returnsValue: updatedFunction.returnsValue }
            };
          });
          if (!mutated) {
            return fn;
          }
          return {
            ...fn,
            nodes: updatedNodes
          };
        })
      );
      setNodes((current: FlowNode[]) => {
        let mutated = false;
        const next = current.map((node) => {
          if (node.type !== 'function') {
            return node;
          }
          const data = node.data as FunctionNodeData;
          if (data.functionId !== updatedFunction.id || (data.functionName === updatedFunction.name && data.returnsValue === updatedFunction.returnsValue)) {
            return node;
          }
          mutated = true;
          return {
            ...node,
            data: { ...data, functionName: updatedFunction.name, returnsValue: updatedFunction.returnsValue }
          };
        });
        return mutated ? next : current;
      });
      setActiveFunction(updatedFunction);
      setHasUnsavedChanges(true);
      logicLogger.info('Function updated locally', { projectId, functionId: updatedFunction.id });
    },
    [projectId]
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
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0)
      });
      const type = event.dataTransfer.getData('application/reactflow') as PaletteNodeType | undefined;
      if (!type) {
        const functionPayload = event.dataTransfer.getData(FUNCTION_DRAG_DATA);
        if (functionPayload) {
          try {
            const parsed = JSON.parse(functionPayload) as { functionId: string };
            handleAddFunctionNode(parsed.functionId, position);
          } catch (error) {
            logicLogger.error('Invalid function drag payload', { error: (error as Error).message });
          }
        }
        return;
      }
      handleAddNode(type, position);
    },
    [handleAddFunctionNode, handleAddNode, reactFlowInstance]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      processEditorShortcut(event, {
        onSave: handleSave,
        onUndo: handleUndoAction,
        onRedo: handleRedoAction,
        allowInputTargets: true,
        logger: (message, meta) =>
          logicLogger.info(message, {
            ...meta,
            projectId
          })
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedoAction, handleSave, handleUndoAction, projectId]);

  const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: FlowNode[] }) => {
    setSelectedNodeIds(selected.map((node) => node.id));
  }, []);

  const projectPointer = useCallback(
    (event: PointerEvent): { screen: ScreenPoint; flow: XYPosition } | null => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) {
        logicLogger.warn('Unable to project pointer without wrapper bounds', { projectId });
        return null;
      }
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      const flowPoint = reactFlowInstance.project({ x: localX, y: localY });
      return {
        screen: { x: localX, y: localY },
        flow: flowPoint
      };
    },
    [projectId, reactFlowInstance]
  );

  const beginCutGesture = useCallback(
    (event: PointerEvent) => {
      const projected = projectPointer(event);
      if (!projected) {
        return;
      }
      const gesture: GestureState = {
        startFlow: projected.flow,
        currentFlow: projected.flow,
        startScreen: projected.screen,
        currentScreen: projected.screen
      };
      interactionRef.current = { mode: 'cut', pointerId: event.pointerId };
      setEdgeCutGesture(gesture);
      edgeCutGestureRef.current = gesture;
      logicLogger.debug('Edge cut gesture started', { projectId, x: gesture.startFlow.x, y: gesture.startFlow.y });
    },
    [projectId, projectPointer]
  );

  const beginMarqueeGesture = useCallback(
    (event: PointerEvent) => {
      const projected = projectPointer(event);
      if (!projected) {
        return;
      }
      const gesture: GestureState = {
        startFlow: projected.flow,
        currentFlow: projected.flow,
        startScreen: projected.screen,
        currentScreen: projected.screen
      };
      interactionRef.current = { mode: 'marquee', pointerId: event.pointerId };
      setMarqueeGesture(gesture);
      marqueeGestureRef.current = gesture;
      logicLogger.debug('Marquee selection started', { projectId, x: gesture.startFlow.x, y: gesture.startFlow.y });
    },
    [projectId, projectPointer]
  );

  const updateCutGesture = useCallback(
    (event: PointerEvent) => {
      const projected = projectPointer(event);
      if (!projected) {
        return;
      }
      setEdgeCutGesture((current) => {
        if (!current) {
          return current;
        }
        const next: GestureState = {
          ...current,
          currentFlow: projected.flow,
          currentScreen: projected.screen
        };
        edgeCutGestureRef.current = next;
        return next;
      });
    },
    [projectPointer]
  );

  const updateMarqueeGesture = useCallback(
    (event: PointerEvent) => {
      const projected = projectPointer(event);
      if (!projected) {
        return;
      }
      setMarqueeGesture((current) => {
        if (!current) {
          return current;
        }
        const next: GestureState = {
          ...current,
          currentFlow: projected.flow,
          currentScreen: projected.screen
        };
        marqueeGestureRef.current = next;
        return next;
      });
    },
    [projectPointer]
  );

  const finalizeCutGesture = useCallback(() => {
    const gesture = edgeCutGestureRef.current;
    setEdgeCutGesture(null);
    edgeCutGestureRef.current = null;
    if (!gesture) {
      return;
    }
    const distance = gestureDistance(gesture);
    if (distance < MIN_GESTURE_DISTANCE) {
      logicLogger.debug('Edge cut gesture cancelled due to small distance', { projectId, distance });
      return;
    }
    const nodePositions = buildNodePositionMap(reactFlowInstance.getNodes());
    const intersecting = findEdgesIntersectingSegment(edgesRef.current, nodePositions, {
      start: gesture.startFlow,
      end: gesture.currentFlow
    });
    if (intersecting.length === 0) {
      logicLogger.debug('Edge cut gesture finished without intersections', { projectId, distance });
      return;
    }
    severEdges(intersecting, { reason: 'cut-gesture' });
  }, [projectId, reactFlowInstance, severEdges]);

  const finalizeMarqueeGesture = useCallback(() => {
    const gesture = marqueeGestureRef.current;
    setMarqueeGesture(null);
    marqueeGestureRef.current = null;
    if (!gesture) {
      return;
    }
    const rect = createRectFromPoints(gesture.startFlow, gesture.currentFlow);
    if (!rect) {
      logicLogger.debug('Marquee gesture cancelled due to insufficient area', { projectId });
      return;
    }
    const rfNodes = reactFlowInstance.getNodes();
    const selectedNodes = getNodesWithinRect(rfNodes, rect);
    const selectedIds = selectedNodes.map((node) => node.id);
    const selectionSet = new Set(selectedIds);
    reactFlowInstance.setNodes((current) =>
      current.map((node) => {
        const shouldSelect = selectionSet.has(node.id);
        return node.selected === shouldSelect ? node : { ...node, selected: shouldSelect };
      })
    );
    setSelectedNodeIds(selectedIds);
    logicLogger.info('Marquee selection applied', { projectId, count: selectedIds.length, rect });
    setFeedback(selectedIds.length ? `Selected ${selectedIds.length} node${selectedIds.length > 1 ? 's' : ''}` : 'No nodes selected');
    setTimeout(() => setFeedback(''), 2000);
  }, [projectId, reactFlowInstance]);

  const handlePanePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0 || interactionRef.current) {
        return;
      }
      if (!isPaneTarget(event.target)) {
        return;
      }
      if (event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        beginCutGesture(event);
        return;
      }
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        beginMarqueeGesture(event);
      }
    },
    [beginCutGesture, beginMarqueeGesture]
  );

  useEffect(() => {
    const element = reactFlowWrapper.current;
    if (!element) {
      return;
    }
    element.addEventListener('pointerdown', handlePanePointerDown);
    return () => {
      element.removeEventListener('pointerdown', handlePanePointerDown);
    };
  }, [handlePanePointerDown]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }
      if (interaction.mode === 'cut') {
        updateCutGesture(event);
      } else {
        updateMarqueeGesture(event);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }
      if (interaction.mode === 'cut') {
        finalizeCutGesture();
      } else {
        finalizeMarqueeGesture();
      }
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [finalizeCutGesture, finalizeMarqueeGesture, updateCutGesture, updateMarqueeGesture]);

  const edgeActions = useMemo(
    () => ({
      severEdge: (edgeId: string, options: { reason: SeverEdgeReason }) => {
        severEdges([edgeId], { reason: options.reason });
      }
    }),
    [severEdges]
  );

  const isSaving = saveMutation.isPending || createPageMutation.isPending;
  const isLoading = graphQuery.isLoading || !projectId;

  const headerContent = useMemo(() => {
    if (!projectId) {
      return 'Select a project to begin.';
    }
    return `Project ${projectId}`;
  }, [projectId]);

  const paletteWrapperStyle = useMemo(
    () => ({ width: isNodePaletteVisible ? '18rem' : 0 }),
    [isNodePaletteVisible]
  );

  const paletteInnerClassName = useMemo(
    () =>
      `h-full w-72 transition-transform duration-[250ms] ease-in-out will-change-transform ${
        isNodePaletteVisible ? 'translate-x-0' : '-translate-x-full'
      }`,
    [isNodePaletteVisible]
  );

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
    <>
      <div className="flex h-screen overflow-hidden">
        <div
          className="relative shrink-0 overflow-hidden transition-[width] duration-[250ms] ease-in-out"
          style={paletteWrapperStyle}
          aria-hidden={!isNodePaletteVisible}
          data-testid="node-palette-wrapper"
        >
          <div className={paletteInnerClassName}>
            <LogicNodePalette
              onAddNode={handlePaletteAdd}
              userFunctions={functions.map((fn) => ({ id: fn.id, name: fn.name, returnsValue: fn.returnsValue }))}
              onCreateFunction={handleCreateFunction}
              onEditFunction={handleEditFunction}
              onDeleteFunction={handleDeleteFunction}
              onAddFunctionNode={(functionId) => handleAddFunctionNode(functionId)}
              pageRoutes={knownPageRoutes}
              isPageRoutesLoading={pagesQuery.isLoading}
              pageRoutesError={pageRoutesErrorMessage || undefined}
              onOpenDatabaseDesigner={handleOpenDatabaseDesigner}
              onEditDatabase={handleEditDatabaseSchema}
              databases={databases.map((schema) => ({
                id: schema.id,
                name: schema.name,
                tableCount: schema.tables?.length ?? 0
              }))}
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/5 bg-bw-ink/80 px-6 py-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Logic editor</p>
              <p className="text-lg font-semibold">{headerContent}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => toggleNodePaletteVisibility('header-control')}
                aria-pressed={isNodePaletteVisible}
                aria-label={isNodePaletteVisible ? 'Hide node palette sidebar' : 'Show node palette sidebar'}
                data-testid="toggle-node-palette"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-bw-platinum/90 transition hover:-translate-y-0.5"
                title={isNodePaletteVisible ? 'Hide node palette' : 'Show node palette'}
              >
                {isNodePaletteVisible ? 'Hide Sidebar' : 'Show Sidebar'}
              </button>
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
            {!isNodePaletteVisible && (
              <div className="pointer-events-none absolute left-4 top-4 z-20">
                <button
                  type="button"
                  onClick={() => toggleNodePaletteVisibility('canvas-floating-control')}
                  className="pointer-events-auto rounded-full border border-white/20 bg-bw-ink/90 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                  aria-label="Show node palette"
                  data-testid="floating-node-palette-toggle"
                >
                  Show Sidebar
                </button>
              </div>
            )}
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
            <div ref={reactFlowWrapper} className="relative h-full">
              <PreviewResolverProvider resolver={previewResolver}>
                <PageRouteRegistryProvider value={pageRouteRegistryValue}>
                  <LogicNavigationProvider value={{ openPageBuilder: handleNavigateToBuilder }}>
                    <FunctionRegistryProvider functions={functions}>
                      <LogicEdgeActionsProvider value={edgeActions}>
                        <ReactFlow
                          nodes={nodes}
                          edges={edges}
                          nodeTypes={nodeTypes}
                          edgeTypes={edgeTypes}
                          defaultEdgeOptions={{ type: 'severable' }}
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
                          connectionLineStyle={connectionLineStyle}
                        >
                          <MiniMap pannable zoomable className="!bg-bw-ink/80" />
                          <Controls />
                          <Background gap={16} color="#ffffff33" />
                        </ReactFlow>
                      </LogicEdgeActionsProvider>
                    </FunctionRegistryProvider>
                  </LogicNavigationProvider>
                </PageRouteRegistryProvider>
              </PreviewResolverProvider>
              <div className="pointer-events-none absolute inset-0">
                {edgeCutGesture && (
                  <svg className="h-full w-full" data-testid="edge-cut-overlay">
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
                )}
                {marqueeGesture && (
                  <div
                    data-testid="marquee-overlay"
                    className="absolute border border-bw-sand/80 bg-bw-sand/20"
                    style={{
                      left: Math.min(marqueeGesture.startScreen.x, marqueeGesture.currentScreen.x),
                      top: Math.min(marqueeGesture.startScreen.y, marqueeGesture.currentScreen.y),
                      width: Math.abs(marqueeGesture.startScreen.x - marqueeGesture.currentScreen.x),
                      height: Math.abs(marqueeGesture.startScreen.y - marqueeGesture.currentScreen.y)
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {activeFunction && (
        <FunctionEditorModal
          functionDef={activeFunction}
          functions={functions}
          onSave={handleFunctionSave}
          onClose={() => setActiveFunction(null)}
        />
      )}
      {isDatabaseDesignerOpen && activeDatabaseSchema && (
        <DatabaseDesignerModal
          initialSchema={activeDatabaseSchema}
          onSave={handleDatabaseSave}
          onApply={handleDatabaseApply}
          onLoadFromDatabase={handleDatabaseIntrospect}
          onClose={handleCloseDatabaseDesigner}
        />
      )}
    </>
  );
};

export const ProjectLogicPage = () => (
  <ReactFlowProvider>
    <LogicEditorView />
  </ReactFlowProvider>
);

type PageRouteSummary = {
  routes: string[];
  ownership: Record<string, string[]>;
};

export function collectPageRoutes(nodes: FlowNode[], remotePages: PageDocument[] = []): PageRouteSummary {
  const routeOwners = new Map<string, Set<string>>();
  const trackRoute = (candidate?: string, fallback?: string, ownerId?: string) => {
    const normalized = normalizeRouteSegment(candidate ?? '', fallback);
    if (!normalized) {
      return;
    }
    if (!routeOwners.has(normalized)) {
      routeOwners.set(normalized, new Set());
    }
    if (ownerId) {
      routeOwners.get(normalized)?.add(ownerId);
    }
  };

  remotePages.forEach((page) => trackRoute(page.slug, page.name, page.id));
  nodes.forEach((node) => {
    if (node.type !== 'page') {
      return;
    }
    const pageData = node.data as Partial<PageNodeData> | undefined;
    trackRoute(pageData?.routeSegment, pageData?.pageName, pageData?.pageId ?? node.id);
  });

  const routes = Array.from(routeOwners.keys()).sort((a, b) => a.localeCompare(b));
  const ownership: Record<string, string[]> = {};
  routes.forEach((route) => {
    ownership[route] = Array.from(routeOwners.get(route) ?? []).sort((a, b) => a.localeCompare(b));
  });

  return { routes, ownership };
}

export { createPageNode, serializeNodes, serializeEdges };

type PageNodeInputSummary = {
  pageNodes: number;
  inputCounts: Record<string, number>;
  missingListMetadata: Array<{ nodeId: string; inputId?: string; label?: string }>;
};

function summarizePageNodeInputs(nodes: LogicEditorNode[]): PageNodeInputSummary | null {
  const pageNodes = nodes.filter((node) => node.type === 'page');
  if (!pageNodes.length) {
    return null;
  }
  const inputCounts: Record<string, number> = {};
  const missingListMetadata: Array<{ nodeId: string; inputId?: string; label?: string }> = [];
  for (const node of pageNodes) {
    const data = node.data as Partial<PageNodeData> | undefined;
    const inputs = Array.isArray(data?.inputs) ? data.inputs : [];
    for (const input of inputs) {
      const type = input?.dataType ?? 'unknown';
      inputCounts[type] = (inputCounts[type] ?? 0) + 1;
      if (type === 'list' && !input?.listItemType) {
        missingListMetadata.push({ nodeId: node.id, inputId: input?.id, label: input?.label });
      }
    }
  }
  return { pageNodes: pageNodes.length, inputCounts, missingListMetadata };
}

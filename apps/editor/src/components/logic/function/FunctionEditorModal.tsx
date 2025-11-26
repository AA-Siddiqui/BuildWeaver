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
import type { FunctionArgumentNodeData, LogicEditorNodeData, UserDefinedFunction } from '@buildweaver/libs';
import { FUNCTION_DRAG_DATA, LogicNodePalette } from '../LogicNodePalette';
import { useDeleteNodesShortcut } from '../../../hooks/useDeleteNodesShortcut';
import { logicLogger } from '../../../lib/logger';
import {
  FlowEdge,
  FlowNode,
  serializeEdges,
  serializeNodes,
  toFlowEdges,
  toFlowNodes
} from '../graphSerialization';
import {
  ExtendedPaletteNodeType,
  PaletteNodeType,
  createFunctionArgumentNode,
  createFunctionReferenceNode,
  createFunctionReturnNode,
  staticNodeFactory
} from '../nodeFactories';
import { FunctionRegistryProvider } from './FunctionRegistryContext';
import { FunctionNode } from './FunctionNode';
import { FunctionArgumentNode } from './FunctionArgumentNode';
import { FunctionReturnNode } from './FunctionReturnNode';
import { PreviewResolverProvider, createPreviewResolver } from '../previewResolver';
import { DummyNode } from '../DummyNode';
import { PageNode } from '../PageNode';
import { ArithmeticNode } from '../ArithmeticNode';
import { StringNode } from '../StringNode';
import { ListNode } from '../ListNode';
import { ObjectNode } from '../ObjectNode';
import { ConditionalNode } from '../ConditionalNode';
import { LogicalOperatorNode } from '../LogicalOperatorNode';
import { RelationalOperatorNode } from '../RelationalOperatorNode';

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
  'function-return': FunctionReturnNode
};

const extraPaletteItems: Array<{ type: ExtendedPaletteNodeType; label: string; description: string }> = [
  { type: 'function-argument', label: 'Argument', description: 'Expose a function parameter' },
  { type: 'function-return', label: 'Return', description: 'Define the output value' }
];

interface FunctionEditorModalProps {
  functionDef: UserDefinedFunction;
  functions: UserDefinedFunction[];
  onSave: (fn: UserDefinedFunction) => void;
  onClose: () => void;
}

const FunctionEditorCanvas = ({ functionDef, functions, onSave, onClose }: FunctionEditorModalProps) => {
  const [name, setName] = useState(functionDef.name);
  const [description, setDescription] = useState(functionDef.description ?? '');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow<Node<LogicEditorNodeData>>();
  const [nodes, setNodes, onNodesChange] = useNodesState<LogicEditorNodeData>(toFlowNodes(functionDef.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(functionDef.edges));
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const previewResolver = useMemo(
    () => createPreviewResolver(nodes, edges, { functions }),
    [nodes, edges, functions]
  );
  const connectionLineStyle = useMemo(() => ({ stroke: '#F9E7B2', strokeWidth: 2 }), []);

  useEffect(() => {
    setNodes(toFlowNodes(functionDef.nodes));
    setEdges(toFlowEdges(functionDef.edges));
    setName(functionDef.name);
    setDescription(functionDef.description ?? '');
    setHasUnsavedChanges(false);
    setSelectedNodeIds([]);
    setFeedback('');
  }, [functionDef, setEdges, setNodes]);

  const deleteElements = useCallback(
    (elements: { nodes?: FlowNode[]; edges?: FlowEdge[] }) => {
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
      setEdges((eds) => addEdge({ ...connection, id: `${connection.source}-${connection.target}-${Date.now()}` }, eds));
      setHasUnsavedChanges(true);
    },
    [setEdges]
  );

  const handleAddNode = useCallback(
    (type: PaletteNodeType, position?: { x: number; y: number }) => {
      const factory = staticNodeFactory[type as Exclude<PaletteNodeType, 'page'>];
      if (!factory) {
        logicLogger.warn('Function editor attempted to add unsupported node', { type });
        return;
      }
      const node = factory(position);
      setNodes((current) => current.concat(node));
      setHasUnsavedChanges(true);
    },
    [setNodes]
  );

  const handleAddExtraNode = useCallback(
    (type: ExtendedPaletteNodeType, position?: { x: number; y: number }) => {
      if (type === 'function-argument') {
        const node = createFunctionArgumentNode(position);
        setNodes((current) => current.concat(node));
        setHasUnsavedChanges(true);
        return;
      }
      if (type === 'function-return') {
        const existing = nodes.find((node) => node.type === 'function-return');
        if (existing) {
          setFeedback('Return node already added');
          setTimeout(() => setFeedback(''), 2000);
          return;
        }
        const node = createFunctionReturnNode(position);
        setNodes((current) => current.concat(node));
        setHasUnsavedChanges(true);
      }
    },
    [nodes, setNodes]
  );

  const handleAddFunctionNode = useCallback(
    (functionId: string, position?: { x: number; y: number }) => {
      const target = functions.find((fn) => fn.id === functionId);
      if (!target) {
        setFeedback('Function not found');
        setTimeout(() => setFeedback(''), 2000);
        return;
      }
      const node = createFunctionReferenceNode(functionId, target.name, target.returnsValue ?? false, position, 'applied');
      setNodes((current) => current.concat(node));
      setHasUnsavedChanges(true);
    },
    [functions, setNodes]
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
      const functionPayload = event.dataTransfer.getData(FUNCTION_DRAG_DATA);
      if (functionPayload) {
        try {
          const parsed = JSON.parse(functionPayload) as { functionId: string };
          handleAddFunctionNode(parsed.functionId, position);
          return;
        } catch {
          // ignore
        }
      }
      const type = event.dataTransfer.getData('application/reactflow') as ExtendedPaletteNodeType | undefined;
      if (!type) {
        return;
      }
      if (type === 'function-argument' || type === 'function-return') {
        handleAddExtraNode(type, position);
        return;
      }
      handleAddNode(type as PaletteNodeType, position);
    },
    [handleAddExtraNode, handleAddFunctionNode, handleAddNode, reactFlowInstance]
  );

  const handleSelectionChange = useCallback(({ nodes: selected }: { nodes: FlowNode[] }) => {
    setSelectedNodeIds(selected.map((node) => node.id));
  }, []);

  const serializedArguments = useCallback(() => {
    const entries = serializeNodes(nodes).filter((node) => node.type === 'function-argument');
    return entries.map((node) => {
      const data = node.data as FunctionArgumentNodeData;
      return {
        id: data.argumentId,
        name: data.name,
        type: data.type
      };
    });
  }, [nodes]);

  const hasReturnNode = useMemo(() => nodes.some((node) => node.type === 'function-return'), [nodes]);

  const handleSave = useCallback(() => {
    const serializedNodes = serializeNodes(nodes);
    const serializedEdges = serializeEdges(edges);
    const updated: UserDefinedFunction = {
      ...functionDef,
      name: name.trim() || 'Untitled function',
      description: description.trim() || undefined,
      nodes: serializedNodes,
      edges: serializedEdges,
      arguments: serializedArguments(),
      returnsValue: hasReturnNode,
      updatedAt: new Date().toISOString()
    };
    logicLogger.info('Function editor saved changes', {
      functionId: updated.id,
      nodes: updated.nodes.length,
      edges: updated.edges.length,
      arguments: updated.arguments.length,
      returnsValue: updated.returnsValue
    });
    onSave(updated);
    setHasUnsavedChanges(false);
    setFeedback('Function saved');
    setTimeout(() => setFeedback(''), 1500);
  }, [description, edges, functionDef, hasReturnNode, name, nodes, onSave, serializedArguments]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      handleSave();
    }
    onClose();
  }, [handleSave, hasUnsavedChanges, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex h-screen bg-bw-ink text-white">
      <LogicNodePalette
        onAddNode={handleAddNode}
        userFunctions={functions.map((fn) => ({ id: fn.id, name: fn.name, returnsValue: fn.returnsValue }))}
        onAddFunctionNode={handleAddFunctionNode}
        extraItems={extraPaletteItems}
        onAddExtraNode={handleAddExtraNode}
        disablePageNode
      />
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
              placeholder="Function name"
            />
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setHasUnsavedChanges(true);
              }}
              className="min-h-[60px] rounded-xl border border-white/10 bg-bw-ink/60 px-4 py-2 text-sm"
              placeholder="Describe what this function does"
            />
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
              Save function
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-white/20 px-4 py-2 font-semibold text-white"
            >
              Return to main canvas
            </button>
          </div>
        </header>
        <div className="relative flex-1">
          <div ref={reactFlowWrapper} className="h-full">
            <FunctionRegistryProvider functions={functions}>
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
            </FunctionRegistryProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FunctionEditorModal = (props: FunctionEditorModalProps) => (
  <ReactFlowProvider>
    <FunctionEditorCanvas {...props} />
  </ReactFlowProvider>
);

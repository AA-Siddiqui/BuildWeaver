import type {
  ArithmeticNodeData,
  ArithmeticOperand,
  ConditionalNodeData,
  DummyNodeData,
  DummySampleValue,
  ListNodeData,
  LogicalOperatorNodeData,
  LogicEditorEdge,
  LogicEditorNode,
  ObjectNodeData,
  RelationalOperatorNodeData,
  StringNodeData,
  StringNodeInput
} from '@buildweaver/libs';
import type { AiLogicGenerationResult, AiNode } from './schemas/logic-generation';

// ── ID generation ──────────────────────────────────────────────────

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
};

// ── Layout constants ───────────────────────────────────────────────

const COLUMN_GAP = 320;
const ROW_GAP = 220;
const MAX_ROWS = 5;

// ── Handle-mapping tables ──────────────────────────────────────────
//
// Each entry maps a toSlot index to the actual React Flow handle ID.
// For arithmetic / string nodes the handles are dynamic (operand IDs),
// so they are resolved separately during node construction.

type SlotResolver = (nodeId: string, slot: number, nodeData: unknown) => string | null;

const listSlots = ['primary', 'secondary', 'start', 'end', 'order', 'callback', 'initial'];
const objectSlots = ['source', 'patch', 'keys', 'key', 'value'];
const conditionalSlots = ['condition', 'truthy', 'falsy'];
const logicalSlots = ['primary', 'secondary'];
const relationalSlots = ['left', 'right'];

const resolveTargetHandle: SlotResolver = (nodeId, slot, nodeData) => {
  const data = nodeData as { kind: string };
  switch (data.kind) {
    case 'dummy':
      return null; // dummy has no input handles

    case 'arithmetic': {
      const aData = nodeData as ArithmeticNodeData;
      if (slot < 0 || slot >= aData.operands.length) return null;
      return `operand-${aData.operands[slot].id}`;
    }

    case 'string': {
      const sData = nodeData as StringNodeData;
      if (slot < 0 || slot >= sData.stringInputs.length) return null;
      return `string-${sData.stringInputs[slot].id}`;
    }

    case 'list': {
      const role = listSlots[slot];
      return role ? `list-${nodeId}-${role}` : null;
    }

    case 'object': {
      const role = objectSlots[slot];
      return role ? `object-${nodeId}-${role}` : null;
    }

    case 'conditional': {
      const role = conditionalSlots[slot];
      return role ? `conditional-${nodeId}-${role}` : null;
    }

    case 'logical': {
      const role = logicalSlots[slot];
      return role ? `logical-${nodeId}-${role}` : null;
    }

    case 'relational': {
      const role = relationalSlots[slot];
      return role ? `relational-${nodeId}-${role}` : null;
    }

    default:
      return null;
  }
};

const resolveSourceHandle = (nodeId: string, kind: string): string => {
  if (kind === 'dummy') return 'dummy-output';
  return `${kind}-${nodeId}-out`;
};

// ── Node data builders ─────────────────────────────────────────────

const buildDummySample = (
  sampleType: 'integer' | 'decimal' | 'string' | 'boolean',
  sampleValue: number | string | boolean
): DummySampleValue => {
  switch (sampleType) {
    case 'integer':
      return { type: 'integer', value: typeof sampleValue === 'number' ? Math.round(sampleValue) : 0 };
    case 'decimal':
      return { type: 'decimal', value: typeof sampleValue === 'number' ? sampleValue : 0 };
    case 'string':
      return { type: 'string', value: String(sampleValue) };
    case 'boolean':
      return { type: 'boolean', value: Boolean(sampleValue) };
  }
};

const buildNodeData = (
  aiNode: AiNode
):
  | DummyNodeData
  | ArithmeticNodeData
  | StringNodeData
  | ListNodeData
  | ObjectNodeData
  | ConditionalNodeData
  | LogicalOperatorNodeData
  | RelationalOperatorNodeData => {
  switch (aiNode.kind) {
    case 'dummy':
      return {
        kind: 'dummy',
        label: aiNode.label,
        description: aiNode.description,
        sample: buildDummySample(aiNode.sampleType, aiNode.sampleValue)
      } satisfies DummyNodeData;

    case 'arithmetic': {
      const operands: ArithmeticOperand[] = aiNode.operands.map((op) => ({
        id: `op-${generateId()}`,
        label: op.label,
        sampleValue: op.sampleValue ?? null
      }));
      return {
        kind: 'arithmetic',
        label: aiNode.label,
        description: aiNode.description,
        operation: aiNode.operation,
        precision: 2,
        operands
      } satisfies ArithmeticNodeData;
    }

    case 'string': {
      const stringInputs: StringNodeInput[] = aiNode.inputs.map((inp) => ({
        id: `str-${generateId()}`,
        label: inp.label,
        sampleValue: inp.sampleValue,
        role: inp.role
      }));
      return {
        kind: 'string',
        label: aiNode.label,
        description: aiNode.description,
        operation: aiNode.operation,
        stringInputs
      } satisfies StringNodeData;
    }

    case 'list':
      return {
        kind: 'list',
        label: aiNode.label,
        description: aiNode.description,
        operation: aiNode.operation,
        primarySample: [],
        secondarySample: [],
        startSample: 0,
        endSample: 3,
        sort: 'asc',
        reducerInitialSample: 0,
        reducerInitialSampleKind: 'number'
      } satisfies ListNodeData;

    case 'object':
      return {
        kind: 'object',
        label: aiNode.label,
        description: aiNode.description,
        operation: aiNode.operation,
        sourceSample: {},
        patchSample: {},
        selectedKeys: [],
        path: '',
        valueSample: '',
        valueSampleKind: 'string'
      } satisfies ObjectNodeData;

    case 'conditional':
      return {
        kind: 'conditional',
        label: aiNode.label,
        description: aiNode.description,
        conditionSample: true,
        trueValue: '',
        falseValue: '',
        trueValueKind: 'string',
        falseValueKind: 'string'
      } satisfies ConditionalNodeData;

    case 'logical':
      return {
        kind: 'logical',
        label: aiNode.label,
        description: aiNode.description,
        operation: aiNode.operation,
        primarySample: true,
        secondarySample: false
      } satisfies LogicalOperatorNodeData;

    case 'relational':
      return {
        kind: 'relational',
        label: aiNode.label,
        description: aiNode.description,
        operation: aiNode.operation,
        leftSample: 0,
        rightSample: 0,
        leftSampleKind: 'number',
        rightSampleKind: 'number'
      } satisfies RelationalOperatorNodeData;
  }
};

// ── Transformer ────────────────────────────────────────────────────

export interface TransformedLogic {
  nodes: LogicEditorNode[];
  edges: LogicEditorEdge[];
  summary: string;
}

/**
 * Transforms raw AI generation output into valid LogicEditorNode[]
 * and LogicEditorEdge[] that can be directly rendered on the canvas.
 *
 * - Generates proper UUIDs replacing temporary IDs
 * - Auto-layouts nodes in a left-to-right grid
 * - Resolves edge handles to actual React Flow handle IDs
 * - Discards malformed edges with a warning
 */
export function transformAiLogicOutput(
  aiResult: AiLogicGenerationResult,
  logger?: (message: string, meta?: Record<string, unknown>) => void
): TransformedLogic {
  const log = logger ?? (() => {});

  // 1. Build nodes with real IDs and data
  const tempIdToRealId = new Map<string, string>();
  const tempIdToKind = new Map<string, string>();
  const nodeDataMap = new Map<string, LogicEditorNode['data']>();

  const nodes: LogicEditorNode[] = aiResult.nodes.map((aiNode, index) => {
    const realId = `${aiNode.kind}-${generateId()}`;
    tempIdToRealId.set(aiNode.tempId, realId);
    tempIdToKind.set(aiNode.tempId, aiNode.kind);

    const data = buildNodeData(aiNode);
    nodeDataMap.set(realId, data);

    // Auto-layout: left-to-right, wrapping at MAX_ROWS
    const col = Math.floor(index / MAX_ROWS);
    const row = index % MAX_ROWS;
    const position = { x: col * COLUMN_GAP, y: row * ROW_GAP };

    log('Transformed AI node', {
      tempId: aiNode.tempId,
      realId,
      kind: aiNode.kind,
      label: aiNode.label,
      col,
      row
    });

    return {
      id: realId,
      type: aiNode.kind,
      position,
      data
    } as LogicEditorNode;
  });

  // 2. Build edges with resolved handles
  const edges: LogicEditorEdge[] = [];
  let droppedEdges = 0;

  for (const aiEdge of aiResult.edges) {
    const sourceRealId = tempIdToRealId.get(aiEdge.fromNode);
    const targetRealId = tempIdToRealId.get(aiEdge.toNode);

    if (!sourceRealId || !targetRealId) {
      droppedEdges++;
      log('Dropped edge — dangling node reference', {
        fromNode: aiEdge.fromNode,
        toNode: aiEdge.toNode,
        fromResolved: !!sourceRealId,
        toResolved: !!targetRealId
      });
      continue;
    }

    const sourceKind = tempIdToKind.get(aiEdge.fromNode)!;
    const sourceHandle = resolveSourceHandle(sourceRealId, sourceKind);

    const targetData = nodeDataMap.get(targetRealId);
    if (!targetData) {
      droppedEdges++;
      log('Dropped edge — missing target data', { targetRealId });
      continue;
    }

    const targetHandle = resolveTargetHandle(targetRealId, aiEdge.toSlot, targetData);
    if (!targetHandle) {
      droppedEdges++;
      log('Dropped edge — invalid target slot', {
        toNode: aiEdge.toNode,
        toSlot: aiEdge.toSlot,
        targetKind: (targetData as { kind: string }).kind
      });
      continue;
    }

    const edgeId = `ai-edge-${generateId()}`;

    log('Transformed AI edge', {
      edgeId,
      source: sourceRealId,
      sourceHandle,
      target: targetRealId,
      targetHandle
    });

    edges.push({
      id: edgeId,
      source: sourceRealId,
      target: targetRealId,
      sourceHandle,
      targetHandle
    });
  }

  if (droppedEdges > 0) {
    log('Edge transformation summary', {
      total: aiResult.edges.length,
      valid: edges.length,
      dropped: droppedEdges
    });
  }

  log('AI logic transformation complete', {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    summary: aiResult.summary
  });

  return { nodes, edges, summary: aiResult.summary };
}

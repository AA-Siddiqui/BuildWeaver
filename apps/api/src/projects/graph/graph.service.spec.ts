import { Logger } from '@nestjs/common';
import { ProjectGraphService } from './graph.service';
import type { DatabaseService } from '../../database/database.service';
import type {
  LogicEditorNode,
  LogicEditorEdge,
  QueryDefinition,
  QueryNodeData
} from '@buildweaver/libs';

const createService = () => {
  const databaseStub = { db: {} } as unknown as DatabaseService;
  const service = new ProjectGraphService(databaseStub);
  const scopedLogger = new Logger(ProjectGraphService.name);
  Reflect.set(service as unknown as Record<string, unknown>, 'logger', scopedLogger);
  jest.spyOn(scopedLogger, 'log').mockImplementation(() => {});
  jest.spyOn(scopedLogger, 'debug').mockImplementation(() => {});
  jest.spyOn(scopedLogger, 'warn').mockImplementation(() => {});
  return { service, logger: scopedLogger };
};

type PrivateGraph = {
  evaluateNodeAllowance: ProjectGraphService['evaluateNodeAllowance'];
  sanitizeQueries: ProjectGraphService['sanitizeQueries'];
  sanitizeFunctions: ProjectGraphService['sanitizeFunctions'];
  isEdgeAllowed: ProjectGraphService['isEdgeAllowed'];
  describeEdgeRejection: ProjectGraphService['describeEdgeRejection'];
};

const callEvaluateNodeAllowance = (
  service: ProjectGraphService,
  node: LogicEditorNode,
  allowedPageIds: Set<string>,
  options?: Parameters<PrivateGraph['evaluateNodeAllowance']>[2]
) =>
  (service as unknown as PrivateGraph).evaluateNodeAllowance(node, allowedPageIds, options);

const callSanitizeQueries = (
  service: ProjectGraphService,
  queries: QueryDefinition[],
  pageIds: Set<string>,
  functionIds: Set<string>,
  queryIds: Set<string>
) =>
  (service as unknown as PrivateGraph).sanitizeQueries(queries, pageIds, functionIds, queryIds);

describe('ProjectGraphService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateNodeAllowance – query nodes', () => {
    it('allows a query node with a valid queryId in the allowed set', () => {
      const { service } = createService();
      const node: LogicEditorNode = {
        id: 'query-1',
        type: 'query',
        position: { x: 0, y: 0 },
        data: {
          kind: 'query',
          queryId: 'q-abc',
          queryName: 'Q1',
          mode: 'read',
          schemaId: 'db-1',
          arguments: []
        } satisfies QueryNodeData
      };

      const result = callEvaluateNodeAllowance(service, node, new Set(), {
        allowedQueryIds: new Set(['q-abc'])
      });

      expect(result.allowed).toBe(true);
    });

    it('rejects a query node with a missing queryId', () => {
      const { service } = createService();
      const node: LogicEditorNode = {
        id: 'query-bad',
        type: 'query',
        position: { x: 0, y: 0 },
        data: { kind: 'query' } as unknown as QueryNodeData
      };

      const result = callEvaluateNodeAllowance(service, node, new Set(), {
        allowedQueryIds: new Set(['q-abc'])
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('missing_query_reference');
    });

    it('rejects a query node whose queryId is not in the allowed set', () => {
      const { service } = createService();
      const node: LogicEditorNode = {
        id: 'query-orphan',
        type: 'query',
        position: { x: 0, y: 0 },
        data: {
          kind: 'query',
          queryId: 'q-unknown',
          queryName: 'Gone',
          mode: 'delete',
          schemaId: 'db-1',
          arguments: []
        } satisfies QueryNodeData
      };

      const result = callEvaluateNodeAllowance(service, node, new Set(), {
        allowedQueryIds: new Set(['q-abc'])
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('query_not_found');
    });

    it('rejects query-internal nodes at top level', () => {
      const { service } = createService();
      const internalTypes = [
        'query-argument',
        'query-output',
        'query-table',
        'query-join',
        'query-where'
      ] as const;

      for (const type of internalTypes) {
        const node: LogicEditorNode = {
          id: `${type}-1`,
          type,
          position: { x: 0, y: 0 },
          data: { kind: type } as LogicEditorNode['data']
        };
        const result = callEvaluateNodeAllowance(service, node, new Set());
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('query_scope_only');
      }
    });

    it('allows query-internal nodes when allowQueryInternals is true', () => {
      const { service } = createService();
      const node: LogicEditorNode = {
        id: 'query-output-1',
        type: 'query-output',
        position: { x: 0, y: 0 },
        data: { kind: 'query-output', outputId: 'out-1' }
      };

      const result = callEvaluateNodeAllowance(service, node, new Set(), {
        allowQueryInternals: true
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('sanitizeQueries', () => {
    it('returns empty array when no queries are provided', () => {
      const { service } = createService();
      const result = callSanitizeQueries(service, [], new Set(), new Set(), new Set());
      expect(result).toEqual([]);
    });

    it('skips a query without an id', () => {
      const { service, logger } = createService();
      const warnSpy = jest.spyOn(logger, 'warn');

      const queries = [{ id: '', name: 'Bad' } as unknown as QueryDefinition];
      const result = callSanitizeQueries(service, queries, new Set(), new Set(), new Set());

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping query without id'));
    });

    it('preserves query-internal nodes and allows general nodes within query scope', () => {
      const { service } = createService();
      const queryId = 'q-1';
      const queries: QueryDefinition[] = [
        {
          id: queryId,
          name: 'Test Query',
          mode: 'read',
          schemaId: 'db-1',
          nodes: [
            { id: 'qt-1', type: 'query-table', position: { x: 0, y: 0 }, data: { kind: 'query-table', tableId: 't1', tableName: 'T1', schemaId: 'db-1', selectedColumns: [], columnDefaults: {}, aggregationInputCount: 0 } },
            { id: 'qo-1', type: 'query-output', position: { x: 100, y: 0 }, data: { kind: 'query-output', outputId: 'out-1' } },
            // Dummy nodes are allowed (they're in allowedNonPageNodes)
            { id: 'dummy-ok', type: 'dummy', position: { x: 200, y: 0 }, data: { kind: 'dummy', label: 'Ok', sample: { type: 'integer', value: 0 } } },
            // function-argument nodes should be rejected (not in allowQueryInternals context without allowFunctionInternals)
            { id: 'fn-arg-stray', type: 'function-argument', position: { x: 300, y: 0 }, data: { kind: 'function-argument', argumentId: 'a1', name: 'x', type: 'string' } }
          ],
          edges: [
            { id: 'e-1', source: 'qt-1', target: 'qo-1' },
            { id: 'e-2', source: 'dummy-ok', target: 'qo-1' },
            { id: 'e-3', source: 'fn-arg-stray', target: 'qo-1' }
          ],
          arguments: [{ id: 'arg-1', name: 'userId', type: 'string' }]
        }
      ];

      const result = callSanitizeQueries(
        service,
        queries,
        new Set(),
        new Set(),
        new Set([queryId])
      );

      expect(result).toHaveLength(1);
      const sanitized = result[0];
      // query-table, query-output, and dummy should be kept; function-argument rejected
      expect(sanitized.nodes.map((n) => n.type)).toEqual(['query-table', 'query-output', 'dummy']);
      // Only edges between valid nodes survive (e-3 references fn-arg-stray which is removed)
      expect(sanitized.edges).toHaveLength(2);
      expect(sanitized.edges.map((e) => e.id)).toEqual(['e-1', 'e-2']);
      // Arguments should be preserved
      expect(sanitized.arguments).toHaveLength(1);
      expect(sanitized.arguments[0].name).toBe('userId');
    });

    it('warns when a query has no output node after sanitization', () => {
      const { service, logger } = createService();
      const warnSpy = jest.spyOn(logger, 'warn');

      const queries: QueryDefinition[] = [
        {
          id: 'q-no-output',
          name: 'No Output',
          mode: 'read',
          schemaId: 'db-1',
          nodes: [
            { id: 'qt-1', type: 'query-table', position: { x: 0, y: 0 }, data: { kind: 'query-table', tableId: 't1', tableName: 'T1', schemaId: 'db-1', selectedColumns: [], columnDefaults: {}, aggregationInputCount: 0 } }
          ],
          edges: [],
          arguments: []
        }
      ];

      callSanitizeQueries(service, queries, new Set(), new Set(), new Set(['q-no-output']));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('has no query-output node')
      );
    });

    it('filters out invalid arguments', () => {
      const { service } = createService();
      const queries: QueryDefinition[] = [
        {
          id: 'q-args',
          name: 'Filter Args',
          mode: 'insert',
          schemaId: 'db-1',
          nodes: [],
          edges: [],
          arguments: [
            { id: 'arg-ok', name: 'valid', type: 'string' },
            { id: '', name: 'no-id', type: 'number' },
            { id: 'arg-bad', name: undefined as unknown as string, type: 'string' }
          ]
        }
      ];

      const result = callSanitizeQueries(service, queries, new Set(), new Set(), new Set(['q-args']));
      expect(result[0].arguments).toHaveLength(1);
      expect(result[0].arguments[0].id).toBe('arg-ok');
    });
  });

  describe('edge validation', () => {
    it('allows edges between known nodes', () => {
      const { service } = createService();
      const nodeIds = new Set(['a', 'b']);
      const edge: LogicEditorEdge = { id: 'e-1', source: 'a', target: 'b' };

      const result = (service as unknown as PrivateGraph).isEdgeAllowed(edge, nodeIds);
      expect(result).toBe(true);
    });

    it('rejects edges with missing source or target', () => {
      const { service } = createService();
      const nodeIds = new Set(['a']);

      expect(
        (service as unknown as PrivateGraph).isEdgeAllowed(
          { id: 'e-1', source: 'a', target: 'missing' },
          nodeIds
        )
      ).toBe(false);

      expect(
        (service as unknown as PrivateGraph).describeEdgeRejection(
          { id: 'e-1', source: 'a', target: 'missing' },
          nodeIds
        )
      ).toBe('missing_target');

      expect(
        (service as unknown as PrivateGraph).describeEdgeRejection(
          { id: 'e-2', source: 'missing', target: 'a' },
          nodeIds
        )
      ).toBe('missing_source');

      expect(
        (service as unknown as PrivateGraph).describeEdgeRejection(
          { id: 'e-3', source: 'gone1', target: 'gone2' },
          nodeIds
        )
      ).toBe('source_and_target_missing');
    });
  });
});

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { projectGraphs, projectPages, projects, ProjectPage } from '@buildweaver/db';
import {
  DummyNodeData,
  FunctionNodeData,
  DatabaseField,
  DatabaseSchema,
  DatabaseTable,
  DatabaseRelationship,
  LogicEditorEdge,
  LogicEditorNode,
  LogicEditorNodeType,
  PageNodeData,
  ProjectGraphSnapshot,
  UserDefinedFunction
} from '@buildweaver/libs';

@Injectable()
export class ProjectGraphService {
  private readonly logger = new Logger(ProjectGraphService.name);
  private readonly allowedNonPageNodes: LogicEditorNodeType[] = [
    'dummy',
    'arithmetic',
    'string',
    'list',
    'object',
    'conditional',
    'logical',
    'relational',
    'function',
    'database'
  ];

  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async getGraph(ownerId: string, projectId: string): Promise<ProjectGraphSnapshot> {
    await this.assertProjectOwner(ownerId, projectId);
    this.logger.debug(`Loading logic graph for project=${projectId}`);

    const [graphRecord] = await this.db
      .select()
      .from(projectGraphs)
      .where(eq(projectGraphs.projectId, projectId))
      .limit(1);

    const graph = this.withGraphDefaults(graphRecord?.graph);
    const pages = await this.db
      .select()
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId));

    const composed = this.composeGraph(graph, pages);
    this.logger.debug(
      `Loaded graph nodes=${composed.nodes.length} edges=${composed.edges.length} functions=${composed.functions.length} databases=${composed.databases?.length ?? 0}`
    );
    this.logPageNodeInputSummary(projectId, composed.nodes);
    return composed;
  }

  async saveGraph(ownerId: string, projectId: string, payload: ProjectGraphSnapshot): Promise<ProjectGraphSnapshot> {
    await this.assertProjectOwner(ownerId, projectId);
    this.logger.log(`Persisting logic graph for project=${projectId}`);

    const pages = await this.db
      .select()
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId));
    const pageIds = new Set(pages.map((page) => page.id));

    const normalizedPayload = this.withGraphDefaults(payload);
    this.logPageNodeInputSummary(projectId, normalizedPayload.nodes);
    const declaredFunctionIds = new Set(normalizedPayload.functions.map((fn) => fn.id).filter(Boolean));
    const sanitizedFunctions = this.sanitizeFunctions(normalizedPayload.functions, pageIds, declaredFunctionIds);
    const allowedFunctionIds = new Set(sanitizedFunctions.map((fn) => fn.id));
    const sanitizedDatabases = this.sanitizeDatabases(normalizedPayload.databases);

    const rejectedNodes: { id: string; type: string; reason: string }[] = [];
    const sanitizedNodes = normalizedPayload.nodes.filter((node) => {
      const evaluation = this.evaluateNodeAllowance(node, pageIds, { allowedFunctionIds });
      if (!evaluation.allowed) {
        rejectedNodes.push({ id: node.id, type: node.type, reason: evaluation.reason ?? 'unknown' });
        return false;
      }
      return true;
    });
    const nodeIds = new Set(sanitizedNodes.map((node) => node.id));
    const rejectedEdges: { id: string; source: string; target: string; reason: string }[] = [];
    const sanitizedEdges = normalizedPayload.edges.filter((edge) => {
      const allowed = this.isEdgeAllowed(edge, nodeIds);
      if (!allowed) {
        rejectedEdges.push({ id: edge.id, source: edge.source, target: edge.target, reason: this.describeEdgeRejection(edge, nodeIds) });
      }
      return allowed;
    });
    const snapshot: ProjectGraphSnapshot = {
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      functions: sanitizedFunctions,
      databases: sanitizedDatabases
    };
    if (rejectedNodes.length) {
      this.logger.warn(
        `Rejected ${rejectedNodes.length} nodes during graph persist project=${projectId} details=${JSON.stringify(rejectedNodes)}`
      );
    }
    if (rejectedEdges.length) {
      this.logger.warn(
        `Rejected ${rejectedEdges.length} edges during graph persist project=${projectId} details=${JSON.stringify(rejectedEdges)}`
      );
    }
    this.logger.debug(
      `Sanitized logic graph nodes=${sanitizedNodes.length}/${normalizedPayload.nodes.length} edges=${sanitizedEdges.length}/${normalizedPayload.edges.length} functions=${sanitizedFunctions.length}/${normalizedPayload.functions.length} databases=${sanitizedDatabases.length}/${(normalizedPayload.databases ?? []).length}`
    );

    const existing = await this.db
      .select()
      .from(projectGraphs)
      .where(eq(projectGraphs.projectId, projectId))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(projectGraphs).values({ projectId, graph: snapshot });
    } else {
      await this.db.update(projectGraphs).set({ graph: snapshot }).where(eq(projectGraphs.projectId, projectId));
    }

    const composed = this.composeGraph(snapshot, pages);
    this.logger.log(
      `Graph persisted for project=${projectId} nodes=${composed.nodes.length} edges=${composed.edges.length} functions=${composed.functions.length} databases=${composed.databases?.length ?? 0}`
    );
    return composed;
  }

  private evaluateNodeAllowance(
    node: LogicEditorNode,
    allowedPageIds: Set<string>,
    options?: { allowFunctionInternals?: boolean; allowedFunctionIds?: Set<string> }
  ): { allowed: boolean; reason?: string } {
    if (node.type === 'page') {
      const pageData = node.data as Partial<PageNodeData> | undefined;
      if (!pageData || !pageData.pageId) {
        return { allowed: false, reason: 'missing_page_reference' };
      }
      if (!allowedPageIds.has(pageData.pageId)) {
        return { allowed: false, reason: 'page_not_found' };
      }
      return { allowed: true };
    }
    if (node.type === 'function') {
      const data = node.data as Partial<FunctionNodeData> | undefined;
      if (!data?.functionId) {
        return { allowed: false, reason: 'missing_function_reference' };
      }
      if (options?.allowedFunctionIds && !options.allowedFunctionIds.has(data.functionId)) {
        return { allowed: false, reason: 'function_not_found' };
      }
      return { allowed: true };
    }
    if (node.type === 'function-argument' || node.type === 'function-return') {
      return options?.allowFunctionInternals ? { allowed: true } : { allowed: false, reason: 'function_scope_only' };
    }
    if (!this.allowedNonPageNodes.includes(node.type)) {
      return { allowed: false, reason: 'unsupported_type' };
    }
    return { allowed: true };
  }

  private isEdgeAllowed(edge: LogicEditorEdge, allowedNodeIds: Set<string>): boolean {
    return allowedNodeIds.has(edge.source) && allowedNodeIds.has(edge.target);
  }

  private describeEdgeRejection(edge: LogicEditorEdge, allowedNodeIds: Set<string>): string {
    const missingSource = !allowedNodeIds.has(edge.source);
    const missingTarget = !allowedNodeIds.has(edge.target);
    if (missingSource && missingTarget) {
      return 'source_and_target_missing';
    }
    if (missingSource) {
      return 'missing_source';
    }
    if (missingTarget) {
      return 'missing_target';
    }
    return 'unknown';
  }

  private sanitizeFunctions(
    functions: UserDefinedFunction[],
    allowedPageIds: Set<string>,
    declaredFunctionIds: Set<string>
  ): UserDefinedFunction[] {
    if (!functions?.length) {
      return [];
    }
    return functions
      .map((fn) => {
        if (!fn?.id) {
          this.logger.warn('Skipping function without id');
          return null;
        }
        const rejectedNodes: { id: string; type: string; reason?: string }[] = [];
        const nodes = (fn.nodes ?? []).filter((node) => {
          const evaluation = this.evaluateNodeAllowance(node, allowedPageIds, {
            allowFunctionInternals: true,
            allowedFunctionIds: declaredFunctionIds
          });
          if (!evaluation.allowed) {
            rejectedNodes.push({ id: node.id, type: node.type, reason: evaluation.reason });
          }
          return evaluation.allowed;
        });
        if (rejectedNodes.length) {
          this.logger.warn(
            `Rejected ${rejectedNodes.length} nodes while sanitizing function=${fn.id}: ${JSON.stringify(rejectedNodes)}`
          );
        }
        const nodeIds = new Set(nodes.map((node) => node.id));
        const edges = (fn.edges ?? []).filter((edge) => this.isEdgeAllowed(edge, nodeIds));
        const args = Array.isArray(fn.arguments)
          ? fn.arguments.filter((arg) => Boolean(arg?.id) && typeof arg.name === 'string' && typeof arg.type === 'string')
          : [];
        const returnsValue = nodes.some((node) => node.type === 'function-return');
        return {
          ...fn,
          nodes,
          edges,
          arguments: args,
          returnsValue
        } satisfies UserDefinedFunction;
      })
      .filter((fn): fn is UserDefinedFunction => Boolean(fn));
  }

  private sanitizeDatabases(databases?: DatabaseSchema[] | null): DatabaseSchema[] {
    if (!Array.isArray(databases)) {
      return [];
    }

    return databases
      .filter((schema): schema is DatabaseSchema => Boolean(schema))
      .map((schema, schemaIndex) => {
        const schemaId = schema.id || `db-${schemaIndex}`;
        const tables = Array.isArray(schema.tables)
          ? schema.tables.map((table, tableIndex): DatabaseTable => {
              const tableId = table?.id || `${schemaId}-table-${tableIndex}`;
              const fields = Array.isArray(table?.fields)
                ? this.sanitizeDatabaseFields(tableId, table.fields)
                : this.sanitizeDatabaseFields(tableId, []);
              return {
                ...table,
                id: tableId,
                name: typeof table?.name === 'string' && table.name.trim() ? table.name.trim() : `table_${tableIndex + 1}`,
                fields,
                position: table?.position
              } satisfies DatabaseTable;
            })
          : [];

        const tableIds = new Set(tables.map((table) => table.id));
        const relationships = Array.isArray(schema.relationships)
          ? schema.relationships
              .filter((relationship) =>
                relationship?.sourceTableId && relationship?.targetTableId
                  ? tableIds.has(relationship.sourceTableId) && tableIds.has(relationship.targetTableId)
                  : false
              )
              .map(
                (relationship, relationshipIndex): DatabaseRelationship => ({
                  ...relationship,
                  id: relationship.id || `${schemaId}-rel-${relationshipIndex}`,
                  cardinality: relationship.cardinality === 'one' ? 'one' : 'many',
                  modality: relationship.modality === 1 ? 1 : 0
                })
              )
          : [];

        const connection = schema.connection
          ? {
              host: schema.connection.host ?? 'localhost',
              port: typeof schema.connection.port === 'number' ? schema.connection.port : 5432,
              database: schema.connection.database ?? '',
              user: schema.connection.user ?? '',
              password: schema.connection.password ?? '',
              ssl: Boolean(schema.connection.ssl)
            }
          : undefined;

        return {
          ...schema,
          id: schemaId,
          name: schema.name?.trim() || `Database ${schemaIndex + 1}`,
          tables,
          relationships,
          connection
        } satisfies DatabaseSchema;
      });
  }

  private sanitizeDatabaseFields(tableId: string, fields: DatabaseField[]): DatabaseField[] {
    const ensured = (fields ?? []).map((field: DatabaseField, fieldIndex) => ({
      ...field,
      id: field?.id || `${tableId}-field-${fieldIndex}`,
      name: field?.name?.trim() || `field_${fieldIndex + 1}`,
      type: field?.type ?? 'uuid',
      nullable: Boolean(field?.nullable),
      unique: Boolean(field?.unique),
      defaultValue: field?.defaultValue ?? undefined,
      isId: Boolean(field?.isId)
    }));
    const hasIdField = ensured.some((field) => field.isId);
    if (!hasIdField) {
      ensured.unshift({
        id: `${tableId}-id`,
        name: 'id',
        type: 'uuid',
        nullable: false,
        unique: true,
        isId: true,
        defaultValue: undefined
      });
    }
    return ensured.map((field) => (field.isId ? { ...field, nullable: false, unique: true } : field));
  }

  private composeGraph(graph: ProjectGraphSnapshot, pages: ProjectPage[]): ProjectGraphSnapshot {
    const pageMap = new Map(pages.map((page) => [page.id, page]));
    const nodes = graph.nodes
      .map((node) => this.composeNode(node, pageMap))
      .filter((node): node is LogicEditorNode => Boolean(node));

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter((edge) => this.isEdgeAllowed(edge, nodeIds));
    const functions = (graph.functions ?? []).map((fn) => {
      const fnNodes = (fn.nodes ?? [])
        .map((node) => this.composeNode(node, pageMap))
        .filter((node): node is LogicEditorNode => Boolean(node));
      const fnNodeIds = new Set(fnNodes.map((node) => node.id));
      const fnEdges = (fn.edges ?? []).filter((edge) => this.isEdgeAllowed(edge, fnNodeIds));
      return {
        ...fn,
        nodes: fnNodes,
        edges: fnEdges
      };
    });

    const databases = graph.databases ?? [];
    this.logger.debug(
      `Graph composed for response nodes=${nodes.length} edges=${edges.length} functions=${functions.length} databases=${databases.length}`
    );
    return { nodes, edges, functions, databases };
  }

  private composeNode(node: LogicEditorNode, pageMap: Map<string, ProjectPage>): LogicEditorNode | null {
    if (node.type === 'dummy') {
      const data = node.data as Partial<DummyNodeData> & { value?: number };
      if (data.sample) {
        return node;
      }
      return {
        ...node,
        data: {
          kind: 'dummy',
          label: data.label ?? 'Dummy',
          description: data.description,
          sample: {
            type: 'integer',
            value: typeof data.value === 'number' ? data.value : 0
          }
        }
      } as LogicEditorNode;
    }

    if (node.type !== 'page') {
      return node;
    }
    const pageData = node.data as PageNodeData;
    const page = pageMap.get(pageData.pageId);
    if (!page) {
      return null;
    }
    return {
      ...node,
      data: {
        ...pageData,
        pageName: page.name,
        routeSegment: page.slug,
        inputs: page.dynamicInputs
      }
    };
  }

  private logPageNodeInputSummary(projectId: string, nodes: LogicEditorNode[]): void {
    const pageNodes = nodes.filter((node) => node.type === 'page');
    if (!pageNodes.length) {
      return;
    }
    const counts: Record<string, number> = {};
    const missingListMetadata: Array<{ nodeId: string; inputId?: string; label?: string }> = [];
    for (const node of pageNodes) {
      const data = node.data as Partial<PageNodeData> | undefined;
      const inputs = Array.isArray(data?.inputs) ? data?.inputs : [];
      for (const input of inputs) {
        const dataType = (input as Partial<PageNodeData['inputs'][number]>)?.dataType ?? 'unknown';
        counts[dataType] = (counts[dataType] ?? 0) + 1;
        if (dataType === 'list' && !(input as Partial<PageNodeData['inputs'][number]>)?.listItemType) {
          missingListMetadata.push({ nodeId: node.id, inputId: input?.id, label: input?.label });
        }
      }
    }
    this.logger.debug(
      `Graph input snapshot project=${projectId} pageNodes=${pageNodes.length} inputCounts=${JSON.stringify(counts)}`
    );
    if (missingListMetadata.length) {
      this.logger.warn(
        `List inputs missing item metadata project=${projectId} count=${missingListMetadata.length} details=${JSON.stringify(missingListMetadata)}`
      );
    }
  }

  private withGraphDefaults(graph?: ProjectGraphSnapshot | null): ProjectGraphSnapshot {
    const databases = this.sanitizeDatabases(graph?.databases);
    if (!graph) {
      return { nodes: [], edges: [], functions: [], databases };
    }
    return {
      nodes: graph.nodes ?? [],
      edges: graph.edges ?? [],
      functions: graph.functions ?? [],
      databases
    };
  }

  private async assertProjectOwner(ownerId: string, projectId: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .limit(1);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { projectGraphs, projectPages, projects, ProjectPage } from '@buildweaver/db';
import {
  DummyNodeData,
  LogicEditorEdge,
  LogicEditorNode,
  LogicEditorNodeType,
  PageNodeData,
  ProjectGraphSnapshot
} from '@buildweaver/libs';

@Injectable()
export class ProjectGraphService {
  private readonly logger = new Logger(ProjectGraphService.name);
  private readonly allowedNonPageNodes: LogicEditorNodeType[] = ['dummy', 'arithmetic', 'string', 'list', 'object'];

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

    const graph = graphRecord?.graph ?? { nodes: [], edges: [] };
    const pages = await this.db
      .select()
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId));

    const composed = this.composeGraph(graph, pages);
    this.logger.debug(`Loaded graph nodes=${composed.nodes.length} edges=${composed.edges.length}`);
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

    const sanitizedNodes = payload.nodes.filter((node) => this.isNodeAllowed(node, pageIds));
    const nodeIds = new Set(sanitizedNodes.map((node) => node.id));
    const sanitizedEdges = payload.edges.filter((edge) => this.isEdgeAllowed(edge, nodeIds));
    const snapshot: ProjectGraphSnapshot = { nodes: sanitizedNodes, edges: sanitizedEdges };
    this.logger.debug(
      `Sanitized logic graph nodes=${sanitizedNodes.length}/${payload.nodes.length} edges=${sanitizedEdges.length}/${payload.edges.length}`
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
    this.logger.log(`Graph persisted for project=${projectId} nodes=${composed.nodes.length} edges=${composed.edges.length}`);
    return composed;
  }

  private isNodeAllowed(node: LogicEditorNode, allowedPageIds: Set<string>): boolean {
    if (node.type === 'page') {
      return Boolean(node.data && 'pageId' in node.data && allowedPageIds.has(node.data.pageId));
    }
    return this.allowedNonPageNodes.includes(node.type);
  }

  private isEdgeAllowed(edge: LogicEditorEdge, allowedNodeIds: Set<string>): boolean {
    return allowedNodeIds.has(edge.source) && allowedNodeIds.has(edge.target);
  }

  private composeGraph(graph: ProjectGraphSnapshot, pages: ProjectPage[]): ProjectGraphSnapshot {
    const pageMap = new Map(pages.map((page) => [page.id, page]));
    const nodes = graph.nodes
      .map((node) => {
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
      })
      .filter((node): node is LogicEditorNode => Boolean(node));

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter((edge) => this.isEdgeAllowed(edge, nodeIds));

    return { nodes, edges };
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

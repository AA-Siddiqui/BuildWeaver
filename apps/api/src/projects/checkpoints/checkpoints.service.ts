import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  projectCheckpoints,
  projectComponents,
  projectDeployments,
  projectGraphs,
  projectPages,
  projects,
  type Project,
  type ProjectCheckpoint,
  type ProjectCheckpointSnapshot
} from '@buildweaver/db';
import { DatabaseService } from '../../database/database.service';
import { CreateProjectCheckpointDto } from './dto/create-project-checkpoint.dto';

export interface ProjectCheckpointSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  capturedAt: string;
  counts: {
    pages: number;
    components: number;
    deployments: number;
    graphNodes: number;
    graphEdges: number;
    functions: number;
    databases: number;
    queries: number;
  };
}

@Injectable()
export class ProjectCheckpointsService {
  private readonly logger = new Logger(ProjectCheckpointsService.name);

  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async list(ownerId: string, projectId: string): Promise<ProjectCheckpointSummary[]> {
    await this.assertProjectOwner(ownerId, projectId);

    const checkpoints = await this.db
      .select()
      .from(projectCheckpoints)
      .where(eq(projectCheckpoints.projectId, projectId))
      .orderBy(desc(projectCheckpoints.createdAt));

    this.logger.log('Listed project checkpoints', {
      ownerId,
      projectId,
      count: checkpoints.length
    });

    return checkpoints.map((checkpoint) => this.toSummary(checkpoint));
  }

  async create(ownerId: string, projectId: string, dto: CreateProjectCheckpointDto): Promise<ProjectCheckpointSummary> {
    const project = await this.assertProjectOwner(ownerId, projectId);

    const checkpointName = dto.name.trim();
    if (!checkpointName) {
      throw new BadRequestException('Checkpoint name is required');
    }

    const checkpointDescription = dto.description?.trim() ?? '';

    this.logger.log('Creating project checkpoint', {
      ownerId,
      projectId,
      checkpointName,
      checkpointDescriptionLength: checkpointDescription.length
    });

    const snapshot = await this.captureProjectSnapshot(project);

    const [checkpoint] = await this.db
      .insert(projectCheckpoints)
      .values({
        projectId,
        name: checkpointName,
        description: checkpointDescription,
        snapshot
      })
      .returning();

    const summary = this.toSummary(checkpoint);
    this.logger.log('Project checkpoint created', {
      ownerId,
      projectId,
      checkpointId: checkpoint.id,
      counts: summary.counts
    });

    return summary;
  }

  async restore(ownerId: string, projectId: string, checkpointId: string): Promise<ProjectCheckpointSummary> {
    const project = await this.assertProjectOwner(ownerId, projectId);

    const [checkpoint] = await this.db
      .select()
      .from(projectCheckpoints)
      .where(and(eq(projectCheckpoints.id, checkpointId), eq(projectCheckpoints.projectId, projectId)))
      .limit(1);

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    const snapshot = this.normalizeSnapshot(checkpoint.snapshot, project);

    this.logger.warn('Restoring project checkpoint', {
      ownerId,
      projectId,
      checkpointId,
      checkpointName: checkpoint.name,
      capturedAt: snapshot.capturedAt,
      counts: {
        pages: snapshot.pages.length,
        components: snapshot.components.length,
        deployments: snapshot.deployments.length,
        graphNodes: snapshot.graph?.nodes?.length ?? 0,
        graphEdges: snapshot.graph?.edges?.length ?? 0
      }
    });

    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(projects)
          .set({
            name: snapshot.project.name,
            description: snapshot.project.description,
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId));

        await tx.delete(projectGraphs).where(eq(projectGraphs.projectId, projectId));
        await tx.delete(projectPages).where(eq(projectPages.projectId, projectId));
        await tx.delete(projectComponents).where(eq(projectComponents.projectId, projectId));
        await tx.delete(projectDeployments).where(eq(projectDeployments.projectId, projectId));

        if (snapshot.pages.length > 0) {
          await tx.insert(projectPages).values(
            snapshot.pages.map((page) => ({
              id: page.id,
              projectId,
              name: page.name,
              slug: page.slug,
              builderState: page.builderState,
              dynamicInputs: page.dynamicInputs
            }))
          );
        }

        if (snapshot.graph) {
          await tx.insert(projectGraphs).values({
            projectId,
            graph: snapshot.graph
          });
        }

        if (snapshot.components.length > 0) {
          await tx.insert(projectComponents).values(
            snapshot.components.map((component) => ({
              id: component.id,
              projectId,
              name: component.name,
              slug: component.slug,
              definition: component.definition,
              bindingReferences: component.bindingReferences
            }))
          );
        }

        if (snapshot.deployments.length > 0) {
          await tx.insert(projectDeployments).values(
            snapshot.deployments.map((deployment) => ({
              id: deployment.id,
              projectId,
              ownerId: project.ownerId,
              deploymentName: deployment.deploymentName,
              subdomain: deployment.subdomain,
              frontendDomain: deployment.frontendDomain,
              backendDomain: deployment.backendDomain,
              remotePath: deployment.remotePath,
              status: deployment.status,
              lastError: deployment.lastError,
              deployedAt: this.parseDeploymentDate(deployment.deployedAt, {
                checkpointId,
                deploymentId: deployment.id,
                projectId
              })
            }))
          );
        }
      });
    } catch (error) {
      this.logger.error('Project checkpoint restore failed', {
        ownerId,
        projectId,
        checkpointId,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    this.logger.log('Project checkpoint restored', {
      ownerId,
      projectId,
      checkpointId,
      pages: snapshot.pages.length,
      components: snapshot.components.length,
      deployments: snapshot.deployments.length,
      graphNodes: snapshot.graph?.nodes?.length ?? 0,
      graphEdges: snapshot.graph?.edges?.length ?? 0,
      functions: snapshot.graph?.functions?.length ?? 0,
      databases: snapshot.graph?.databases?.length ?? 0,
      queries: snapshot.graph?.queries?.length ?? 0
    });

    return this.toSummary(checkpoint);
  }

  private async captureProjectSnapshot(project: Project): Promise<ProjectCheckpointSnapshot> {
    const [graphRecord, pages, components, deployments] = await Promise.all([
      this.db
        .select()
        .from(projectGraphs)
        .where(eq(projectGraphs.projectId, project.id))
        .limit(1)
        .then((records) => records[0]),
      this.db.select().from(projectPages).where(eq(projectPages.projectId, project.id)),
      this.db.select().from(projectComponents).where(eq(projectComponents.projectId, project.id)),
      this.db.select().from(projectDeployments).where(eq(projectDeployments.projectId, project.id))
    ]);

    const snapshot: ProjectCheckpointSnapshot = {
      capturedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description
      },
      graph: graphRecord?.graph ?? null,
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        slug: page.slug,
        builderState: page.builderState,
        dynamicInputs: page.dynamicInputs
      })),
      components: components.map((component) => ({
        id: component.id,
        name: component.name,
        slug: component.slug,
        definition: component.definition,
        bindingReferences: component.bindingReferences
      })),
      deployments: deployments.map((deployment) => ({
        id: deployment.id,
        deploymentName: deployment.deploymentName,
        subdomain: deployment.subdomain,
        frontendDomain: deployment.frontendDomain,
        backendDomain: deployment.backendDomain,
        remotePath: deployment.remotePath,
        status: deployment.status,
        lastError: deployment.lastError,
        deployedAt: deployment.deployedAt ? deployment.deployedAt.toISOString() : null
      }))
    };

    this.logger.debug('Captured project snapshot', {
      projectId: project.id,
      pages: snapshot.pages.length,
      components: snapshot.components.length,
      deployments: snapshot.deployments.length,
      graphNodes: snapshot.graph?.nodes?.length ?? 0,
      graphEdges: snapshot.graph?.edges?.length ?? 0
    });

    return snapshot;
  }

  private normalizeSnapshot(snapshot: ProjectCheckpoint['snapshot'], project: Project): ProjectCheckpointSnapshot {
    const fallbackCapturedAt = new Date().toISOString();

    return {
      capturedAt: typeof snapshot?.capturedAt === 'string' ? snapshot.capturedAt : fallbackCapturedAt,
      project: {
        name: snapshot?.project?.name?.trim() || project.name,
        description: snapshot?.project?.description?.trim() ?? project.description
      },
      graph: snapshot?.graph ?? null,
      pages: Array.isArray(snapshot?.pages) ? snapshot.pages : [],
      components: Array.isArray(snapshot?.components) ? snapshot.components : [],
      deployments: Array.isArray(snapshot?.deployments) ? snapshot.deployments : []
    };
  }

  private toSummary(checkpoint: ProjectCheckpoint): ProjectCheckpointSummary {
    const snapshot = checkpoint.snapshot;
    const graph = snapshot?.graph;

    return {
      id: checkpoint.id,
      projectId: checkpoint.projectId,
      name: checkpoint.name,
      description: checkpoint.description,
      createdAt: checkpoint.createdAt,
      updatedAt: checkpoint.updatedAt,
      capturedAt: snapshot?.capturedAt ?? checkpoint.createdAt.toISOString(),
      counts: {
        pages: Array.isArray(snapshot?.pages) ? snapshot.pages.length : 0,
        components: Array.isArray(snapshot?.components) ? snapshot.components.length : 0,
        deployments: Array.isArray(snapshot?.deployments) ? snapshot.deployments.length : 0,
        graphNodes: graph?.nodes?.length ?? 0,
        graphEdges: graph?.edges?.length ?? 0,
        functions: graph?.functions?.length ?? 0,
        databases: graph?.databases?.length ?? 0,
        queries: graph?.queries?.length ?? 0
      }
    };
  }

  private parseDeploymentDate(
    deployedAt: string | null,
    context: { checkpointId: string; deploymentId: string; projectId: string }
  ): Date | null {
    if (!deployedAt) {
      return null;
    }

    const parsed = new Date(deployedAt);
    if (Number.isNaN(parsed.getTime())) {
      this.logger.warn('Deployment timestamp from checkpoint is invalid, defaulting to null', {
        ...context,
        deployedAt
      });
      return null;
    }

    return parsed;
  }

  private async assertProjectOwner(ownerId: string, projectId: string): Promise<Project> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .limit(1);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}

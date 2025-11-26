import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import {
  NewProject,
  Project,
  NewProjectGraph,
  projectGraphs,
  projectPages,
  projects,
  ProjectPage
} from '@buildweaver/db';
import { PageBuilderState, ProjectGraphSnapshot } from '@buildweaver/libs';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async listForUser(ownerId: string): Promise<Project[]> {
    return this.db.select().from(projects).where(eq(projects.ownerId, ownerId));
  }

  async create(ownerId: string, dto: CreateProjectDto): Promise<Project> {
    const [project] = await this.db
      .insert(projects)
      .values({
        ownerId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? ''
      })
      .returning();

    await this.bootstrapProjectSurface(project.id, project.name);

    return project;
  }

  async update(ownerId: string, projectId: string, dto: UpdateProjectDto): Promise<Project> {
    const updatePayload: Partial<NewProject> = { updatedAt: new Date() };
    if (typeof dto.name !== 'undefined') {
      updatePayload.name = dto.name.trim();
    }
    if (typeof dto.description !== 'undefined') {
      updatePayload.description = dto.description?.trim() ?? '';
    }

    const [project] = await this.db
      .update(projects)
      .set(updatePayload)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .returning();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async remove(ownerId: string, projectId: string): Promise<void> {
    const [project] = await this.db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .returning();

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async bootstrapProjectSurface(projectId: string, projectName: string) {
    const page = await this.ensureDefaultPage(projectId, projectName);
    await this.ensureDefaultGraph(projectId, page);
  }

  private async ensureDefaultPage(projectId: string, projectName: string): Promise<ProjectPage> {
    const [existingPage] = await this.db
      .select()
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId))
      .limit(1);

    if (existingPage) {
      return existingPage;
    }

    const builderState: PageBuilderState = {
      root: {
        id: 'root',
        props: {},
        children: []
      }
    };

    const [page] = await this.db
      .insert(projectPages)
      .values({
        projectId,
        name: 'Home',
        slug: this.toSlug(`${projectName}-home`),
        builderState,
        dynamicInputs: []
      })
      .returning();

    return page;
  }

  private async ensureDefaultGraph(projectId: string, page: ProjectPage) {
    const [graph] = await this.db
      .select()
      .from(projectGraphs)
      .where(eq(projectGraphs.projectId, projectId))
      .limit(1);

    if (graph) {
      return graph;
    }

    const defaultGraph: ProjectGraphSnapshot = {
      nodes: [
        {
          id: `dummy-${randomUUID()}`,
          type: 'dummy',
          position: { x: -180, y: 0 },
          data: {
            kind: 'dummy',
            label: 'Dummy',
            description: 'Placeholder output for prototyping',
            sample: {
              type: 'integer',
              value: 42
            }
          }
        },
        {
          id: `page-${page.id}`,
          type: 'page',
          position: { x: 240, y: 0 },
          data: {
            kind: 'page',
            pageId: page.id,
            pageName: page.name,
            routeSegment: page.slug,
            inputs: page.dynamicInputs
          }
        }
      ],
      edges: [],
      functions: []
    };

    const payload: NewProjectGraph = {
      projectId,
      graph: defaultGraph
    };

    await this.db.insert(projectGraphs).values(payload).onConflictDoNothing();
  }

  private toSlug(value: string): string {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 48)
      .replace(/(^-|-$)+/g, '');

    return cleaned || 'page';
  }
}

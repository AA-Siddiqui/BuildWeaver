import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { projectPages, projects, ProjectPage } from '@buildweaver/db';
import { CreateProjectPageDto } from './dto/create-project-page.dto';
import { UpdateProjectPageDto } from './dto/update-project-page.dto';
import { PageDynamicInputDto } from './dto/page-dynamic-input.dto';
import { PageBuilderState, PageDynamicInput } from '@buildweaver/libs';
import { resolvePageSlug } from './slug.util';

@Injectable()
export class ProjectPagesService {
  private readonly logger = new Logger(ProjectPagesService.name);

  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async list(ownerId: string, projectId: string): Promise<ProjectPage[]> {
    await this.assertProjectOwner(ownerId, projectId);
    this.logger.log(`Listing pages for project ${projectId}`);
    return this.db.select().from(projectPages).where(eq(projectPages.projectId, projectId));
  }

  async create(ownerId: string, projectId: string, dto: CreateProjectPageDto): Promise<ProjectPage> {
    await this.assertProjectOwner(ownerId, projectId);

    const builderState = dto.builderState ?? this.createEmptyBuilderState();
    const dynamicInputs = this.normalizeInputs(dto.dynamicInputs ?? []);
    const slug = resolvePageSlug(dto.name, dto.slug);
    this.logger.log(
      `Creating page "${dto.name}" in project ${projectId} (slug=${slug}, content=${this.describeBuilderState(builderState)}, inputs=${dynamicInputs.length})`
    );

    const [page] = await this.db
      .insert(projectPages)
      .values({
        projectId,
        name: dto.name.trim(),
        slug,
        builderState,
        dynamicInputs
      })
      .returning();

    return page;
  }

  async findOne(ownerId: string, projectId: string, pageId: string): Promise<ProjectPage> {
    await this.assertProjectOwner(ownerId, projectId);
    this.logger.log(`Fetching page ${pageId} in project ${projectId}`);
    const [page] = await this.db
      .select()
      .from(projectPages)
      .where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)))
      .limit(1);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async update(ownerId: string, projectId: string, pageId: string, dto: UpdateProjectPageDto): Promise<ProjectPage> {
    await this.assertProjectOwner(ownerId, projectId);

    const updatePayload: Partial<ProjectPage> = { updatedAt: new Date() };
    if (typeof dto.name !== 'undefined') {
      updatePayload.name = dto.name.trim();
      updatePayload.slug = resolvePageSlug(dto.name, dto.slug);
    } else if (typeof dto.slug !== 'undefined') {
      updatePayload.slug = resolvePageSlug('', dto.slug);
    }
    if (typeof dto.builderState !== 'undefined') {
      this.logger.log(
        `Updating builder state for page ${pageId} (project ${projectId}) content=${this.describeBuilderState(dto.builderState)}`
      );
      updatePayload.builderState = dto.builderState;
    }
    if (typeof dto.dynamicInputs !== 'undefined') {
      const normalizedInputs = this.normalizeInputs(dto.dynamicInputs);
      this.logger.log(
        `Updating dynamic inputs for page ${pageId} (project ${projectId}) count=${normalizedInputs.length}`
      );
      updatePayload.dynamicInputs = normalizedInputs;
    }

    const [page] = await this.db
      .update(projectPages)
      .set(updatePayload)
      .where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)))
      .returning();

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  private async assertProjectOwner(ownerId: string, projectId: string) {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .limit(1);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private normalizeInputs(inputs: Array<PageDynamicInput | PageDynamicInputDto>): PageDynamicInput[] {
    const seen = new Set<string>();
    return inputs
      .map((input) => ({
        id: input.id ?? randomUUID(),
        label: input.label.trim(),
        description: input.description?.trim(),
        dataType: input.dataType ?? 'string'
      }))
      .filter((input) => {
        if (!input.label) {
          return false;
        }
        if (seen.has(input.id)) {
          return false;
        }
        seen.add(input.id);
        return true;
      });
  }

  private createEmptyBuilderState(): PageBuilderState {
    return {
      root: {
        id: 'root',
        props: {},
        children: []
      },
      content: [],
      zones: {}
    };
  }

  private describeBuilderState(state?: PageBuilderState): string {
    if (!state || typeof state !== 'object') {
      return 'content=0,zones=0';
    }
    const record = state as Record<string, unknown>;
    const content = Array.isArray(record.content) ? record.content.length : 0;
    const zonesValue = record.zones;
    const zones = zonesValue instanceof Map ? zonesValue.size : zonesValue && typeof zonesValue === 'object' ? Object.keys(zonesValue as Record<string, unknown>).length : 0;
    return `content=${content},zones=${zones}`;
  }
}

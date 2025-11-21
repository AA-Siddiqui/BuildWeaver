import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { projectPages, projects, ProjectPage } from '@buildweaver/db';
import { CreateProjectPageDto } from './dto/create-project-page.dto';
import { UpdateProjectPageDto } from './dto/update-project-page.dto';
import { PageDynamicInputDto } from './dto/page-dynamic-input.dto';
import { PageBuilderState, PageDynamicInput } from '@buildweaver/libs';

@Injectable()
export class ProjectPagesService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async list(ownerId: string, projectId: string): Promise<ProjectPage[]> {
    await this.assertProjectOwner(ownerId, projectId);
    return this.db.select().from(projectPages).where(eq(projectPages.projectId, projectId));
  }

  async create(ownerId: string, projectId: string, dto: CreateProjectPageDto): Promise<ProjectPage> {
    await this.assertProjectOwner(ownerId, projectId);

    const builderState = dto.builderState ?? this.createEmptyBuilderState();
    const dynamicInputs = this.normalizeInputs(dto.dynamicInputs ?? []);

    const [page] = await this.db
      .insert(projectPages)
      .values({
        projectId,
        name: dto.name.trim(),
        slug: this.toSlug(dto.name),
        builderState,
        dynamicInputs
      })
      .returning();

    return page;
  }

  async findOne(ownerId: string, projectId: string, pageId: string): Promise<ProjectPage> {
    await this.assertProjectOwner(ownerId, projectId);
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
      updatePayload.slug = this.toSlug(dto.name);
    }
    if (typeof dto.builderState !== 'undefined') {
      updatePayload.builderState = dto.builderState;
    }
    if (typeof dto.dynamicInputs !== 'undefined') {
      updatePayload.dynamicInputs = this.normalizeInputs(dto.dynamicInputs);
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

  private toSlug(value: string): string {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 48)
      .replace(/(^-|-$)+/g, '');

    return cleaned || `page-${Math.random().toString(36).slice(2, 6)}`;
  }

  private createEmptyBuilderState(): PageBuilderState {
    return {
      root: {
        id: 'root',
        props: {},
        children: []
      }
    };
  }
}

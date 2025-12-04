import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { projectPages, projects, ProjectPage } from '@buildweaver/db';
import { CreateProjectPageDto } from './dto/create-project-page.dto';
import { UpdateProjectPageDto } from './dto/update-project-page.dto';
import { PageDynamicInputDto } from './dto/page-dynamic-input.dto';
import { PageBuilderState, PageDynamicInput, ScalarValue } from '@buildweaver/libs';
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
      .map((input, index) => {
        const id = input.id ?? randomUUID();
        const label = input.label.trim();
        const dataType = input.dataType ?? 'string';
        const listItemType = this.coerceListItemType(
          dataType,
          'listItemType' in input ? input.listItemType : undefined,
          {
            id,
            label,
            index
          }
        );
        const objectSample = this.coerceObjectSample(
          dataType,
          listItemType,
          'objectSample' in input ? input.objectSample : undefined,
          {
            id,
            label,
            index
          }
        );
        return {
          id,
          label,
          description: input.description?.trim(),
          dataType,
          listItemType: dataType === 'list' ? listItemType : undefined,
          objectSample
        } satisfies PageDynamicInput;
      })
      .filter((input) => {
        if (!input.label) {
          this.logger.warn('Dynamic input discarded due to empty label', { inputId: input.id });
          return false;
        }
        if (seen.has(input.id)) {
          this.logger.warn('Dynamic input discarded due to duplicate id', { inputId: input.id });
          return false;
        }
        seen.add(input.id);
        return true;
      });
  }

  private coerceListItemType(
    dataType: PageDynamicInput['dataType'],
    incoming: unknown,
    meta: { id: string; label: string; index: number }
  ): PageDynamicInput['listItemType'] {
    if (dataType !== 'list') {
      return undefined;
    }
    const allowed: PageDynamicInput['listItemType'][] = ['string', 'number', 'boolean', 'object'];
    if (typeof incoming === 'string' && allowed.includes(incoming as PageDynamicInput['listItemType'])) {
      return incoming as PageDynamicInput['listItemType'];
    }
    this.logger.warn('List item type defaulted', {
      inputId: meta.id,
      label: meta.label,
      index: meta.index,
      receivedType: typeof incoming,
      fallback: 'string'
    });
    return 'string';
  }

  private coerceObjectSample(
    dataType: PageDynamicInput['dataType'],
    listItemType: PageDynamicInput['listItemType'],
    sample: unknown,
    meta: { id: string; label: string; index: number }
  ): Record<string, ScalarValue> | undefined {
    const expectsObject = dataType === 'object' || (dataType === 'list' && listItemType === 'object');
    if (!expectsObject || !sample) {
      return undefined;
    }
    if (!isPlainObject(sample)) {
      this.logger.warn('Object sample ignored — expected plain object', {
        inputId: meta.id,
        label: meta.label,
        index: meta.index,
        receivedType: typeof sample
      });
      return undefined;
    }
    const sanitized = sanitizeObjectSample(sample);
    this.logger.log('Object sample parsed for dynamic input', {
      inputId: meta.id,
      label: meta.label,
      index: meta.index,
      keys: Object.keys(sanitized ?? {})
    });
    return sanitized;
  }

  private buildDefaultSection(): { type: string; props: Record<string, unknown> } {
    return {
      type: 'Section',
      props: {
        id: `section-${randomUUID()}`,
        minHeight: '100vh',
        padding: '0px',
        paddingX: '0px',
        paddingY: '0px',
        margin: '0px',
        marginX: '0px',
        marginY: '0px',
        borderWidth: '',
        borderColor: '',
        backgroundColor: '#FFFFFF'
      }
    };
  }

  private createEmptyBuilderState(): PageBuilderState {
    const defaultSection = this.buildDefaultSection();
    this.logger.log('Seeding default builder state with section scaffold', {
      defaultComponent: defaultSection.type,
      minHeight: defaultSection.props?.minHeight
    });
    return {
      root: {
        id: 'root',
        props: {},
        children: []
      },
      content: [defaultSection],
      zones: {}
    } satisfies PageBuilderState;
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

const MAX_SAMPLE_DEPTH = 5;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeScalarValue = (value: unknown, depth = 0): ScalarValue | undefined => {
  if (depth > MAX_SAMPLE_DEPTH) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value as ScalarValue;
  }
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => sanitizeScalarValue(entry, depth + 1))
      .filter((entry): entry is ScalarValue => typeof entry !== 'undefined');
    return entries as unknown as ScalarValue;
  }
  if (isPlainObject(value)) {
    const sanitized: Record<string, ScalarValue> = {};
    Object.entries(value).forEach(([key, entry]) => {
      const cleaned = sanitizeScalarValue(entry, depth + 1);
      if (typeof cleaned !== 'undefined') {
        sanitized[key] = cleaned;
      }
    });
    return sanitized as ScalarValue;
  }
  return undefined;
};

const sanitizeObjectSample = (sample: Record<string, unknown>): Record<string, ScalarValue> | undefined => {
  const sanitized: Record<string, ScalarValue> = {};
  Object.entries(sample).forEach(([key, value]) => {
    const cleaned = sanitizeScalarValue(value);
    if (typeof cleaned !== 'undefined') {
      sanitized[key] = cleaned;
    }
  });
  return Object.keys(sanitized).length ? sanitized : undefined;
};

import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { BuilderComponentDefinition, ComponentBindingReference } from '@buildweaver/libs';
import { projectComponents, projects, type ProjectComponent } from '@buildweaver/db';
import { DatabaseService } from '../../database/database.service';
import { CreateProjectComponentDto } from './dto/create-project-component.dto';
import { resolveComponentSlug } from './slug.util';

@Injectable()
export class ProjectComponentsService {
  private readonly logger = new Logger(ProjectComponentsService.name);

  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async list(ownerId: string, projectId: string): Promise<ProjectComponent[]> {
    await this.assertProjectOwner(ownerId, projectId);
    this.logger.log(`Listing components for project ${projectId}`);
    return this.db.select().from(projectComponents).where(eq(projectComponents.projectId, projectId));
  }

  async findOne(ownerId: string, projectId: string, componentId: string): Promise<ProjectComponent> {
    await this.assertProjectOwner(ownerId, projectId);
    this.logger.log(`Fetching component ${componentId} in project ${projectId}`);
    const [component] = await this.db
      .select()
      .from(projectComponents)
      .where(and(eq(projectComponents.id, componentId), eq(projectComponents.projectId, projectId)))
      .limit(1);

    if (!component) {
      throw new NotFoundException('Component not found');
    }

    return component;
  }

  async create(ownerId: string, projectId: string, dto: CreateProjectComponentDto): Promise<ProjectComponent> {
    await this.assertProjectOwner(ownerId, projectId);

    const name = dto.name.trim();
    const slug = resolveComponentSlug(name, dto.slug);
    const existing = await this.db
      .select({ id: projectComponents.id })
      .from(projectComponents)
      .where(and(eq(projectComponents.projectId, projectId), eq(projectComponents.slug, slug)))
      .limit(1);

    if (existing.length > 0) {
      this.logger.warn('Component name rejected due to project uniqueness', { projectId, name, slug });
      throw new ConflictException('A component with this name already exists in the project');
    }

    const definition = this.normalizeDefinition(dto.definition, { name, projectId });
    const bindingReferences = this.normalizeBindingReferences(dto.bindingReferences, { name, projectId });

    const [component] = await this.db
      .insert(projectComponents)
      .values({
        projectId,
        name,
        slug,
        definition,
        bindingReferences
      })
      .returning();

    this.logger.log('Component saved for project', {
      projectId,
      componentId: component.id,
      name,
      slug,
      bindingReferences: component.bindingReferences?.length ?? 0
    });

    return component;
  }

  private normalizeDefinition(
    definition: BuilderComponentDefinition | undefined,
    meta: { name: string; projectId: string }
  ): BuilderComponentDefinition {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      this.logger.warn('Component definition sanitized to empty object', {
        projectId: meta.projectId,
        name: meta.name,
        receivedType: typeof definition
      });
      return {};
    }
    return definition;
  }

  private normalizeBindingReferences(
    refs: ComponentBindingReference[] | undefined,
    meta: { name: string; projectId: string }
  ): ComponentBindingReference[] {
    if (!refs || !Array.isArray(refs)) {
      return [];
    }
    const seen = new Set<string>();
    const sanitized = refs
      .map((ref, index) => {
        const bindingId = (ref?.bindingId ?? '').trim();
        if (!bindingId) {
          this.logger.warn('Discarded component binding reference missing bindingId', {
            projectId: meta.projectId,
            name: meta.name,
            index
          });
          return null;
        }
        const propertyPath = this.sanitizePropertyPath(ref.propertyPath);
        const signature = `${bindingId}:${propertyPath?.join('.') ?? ''}`;
        if (seen.has(signature)) {
          return null;
        }
        seen.add(signature);
        const entry: ComponentBindingReference = {
          bindingId,
          componentId: ref.componentId?.trim() || undefined,
          componentType: ref.componentType?.trim() || undefined
        };
        if (propertyPath) {
          entry.propertyPath = propertyPath;
        }
        return entry;
      })
      .filter((ref): ref is ComponentBindingReference => Boolean(ref));

    this.logger.log('Normalized component binding references', {
      projectId: meta.projectId,
      name: meta.name,
      count: sanitized.length
    });
    return sanitized;
  }

  private sanitizePropertyPath(path?: string[]): string[] | undefined {
    if (!path || !Array.isArray(path)) {
      return undefined;
    }
    const sanitized = path.map((segment) => String(segment ?? '').trim()).filter((segment) => Boolean(segment));
    return sanitized.length ? sanitized : undefined;
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
}

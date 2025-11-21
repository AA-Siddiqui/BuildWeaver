import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { NewProject, Project, projects } from '@buildweaver/db';
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
}

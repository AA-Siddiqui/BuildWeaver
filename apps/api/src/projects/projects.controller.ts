import { Body, Controller, Delete, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ok } from '../common/api-response';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Lists projects for the authenticated user' })
  async list(@CurrentUser() user: AuthUser) {
    const projects = await this.projectsService.listForUser(user.sub);
    return ok({ projects });
  }

  @Post()
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Creates a new project for the authenticated user' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    const project = await this.projectsService.create(user.sub, dto);
    return ok({ project });
  }

  @Patch(':projectId')
  @ApiResponse({ status: HttpStatus.OK, description: 'Updates a project owned by the authenticated user' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: UpdateProjectDto
  ) {
    const project = await this.projectsService.update(user.sub, projectId, dto);
    return ok({ project });
  }

  @Delete(':projectId')
  @ApiResponse({ status: HttpStatus.OK, description: 'Deletes a project owned by the authenticated user' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ) {
    await this.projectsService.remove(user.sub, projectId);
    return ok({});
  }
}

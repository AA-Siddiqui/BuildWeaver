import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ok } from '../../common/api-response';
import { ProjectsService } from '../projects.service';
import { ProjectAiService } from './ai.service';
import { GenerateLogicDto } from './dto/generate-logic.dto';

@ApiTags('project-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/ai')
export class ProjectAiController {
  private readonly logger = new Logger(ProjectAiController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly aiService: ProjectAiService
  ) {}

  @Post('generate-logic')
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns AI-generated logic nodes and edges' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid prompt or LLM not configured' })
  async generateLogic(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: GenerateLogicDto
  ) {
    this.logger.log('AI logic generation requested', {
      userId: user.sub,
      projectId,
      promptLength: dto.prompt.length
    });

    // Verify the user owns this project
    const projects = await this.projectsService.listForUser(user.sub);
    const ownsProject = projects.some((p) => p.id === projectId);
    if (!ownsProject) {
      this.logger.warn('Project not found or user does not own it', {
        userId: user.sub,
        projectId
      });
      throw new BadRequestException('Project not found');
    }

    try {
      const result = await this.aiService.generateLogic(dto.prompt);

      this.logger.log('AI logic generation succeeded', {
        projectId,
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length,
        summary: result.summary
      });

      return ok({
        nodes: result.nodes,
        edges: result.edges,
        summary: result.summary
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('AI logic generation failed', {
        projectId,
        error: errorMessage
      });

      if (errorMessage.includes('LLM is not configured')) {
        throw new BadRequestException('AI is not configured on this server');
      }

      throw new InternalServerErrorException('AI logic generation failed. Please try again.');
    }
  }
}

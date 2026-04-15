import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ok } from '../../common/api-response';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { CreateProjectCheckpointDto } from './dto/create-project-checkpoint.dto';
import { ProjectCheckpointsService } from './checkpoints.service';

@ApiTags('project-checkpoints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/checkpoints')
export class ProjectCheckpointsController {
  constructor(private readonly checkpointsService: ProjectCheckpointsService) {}

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Lists checkpoints for the project' })
  async list(@CurrentUser() user: AuthUser, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const checkpoints = await this.checkpointsService.list(user.sub, projectId);
    return ok({ checkpoints });
  }

  @Post()
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Creates a checkpoint for the project' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateProjectCheckpointDto
  ) {
    const checkpoint = await this.checkpointsService.create(user.sub, projectId, dto);
    return ok({ checkpoint });
  }

  @Post(':checkpointId/restore')
  @ApiResponse({ status: HttpStatus.OK, description: 'Restores the project from a checkpoint' })
  @HttpCode(HttpStatus.OK)
  async restore(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('checkpointId', new ParseUUIDPipe()) checkpointId: string
  ) {
    const checkpoint = await this.checkpointsService.restore(user.sub, projectId, checkpointId);
    return ok({ checkpoint });
  }
}

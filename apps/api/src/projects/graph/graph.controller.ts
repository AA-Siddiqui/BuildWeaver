import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectGraphService } from './graph.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ok } from '../../common/api-response';
import { SaveProjectGraphDto } from './dto/save-project-graph.dto';

@ApiTags('project-graph')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/graph')
export class ProjectGraphController {
  constructor(private readonly graphService: ProjectGraphService) {}

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the persisted logic graph for the project' })
  async getGraph(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ) {
    const graph = await this.graphService.getGraph(user.sub, projectId);
    return ok({ graph });
  }

  @Put()
  @ApiResponse({ status: HttpStatus.OK, description: 'Persists the logic graph for the project' })
  async saveGraph(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: SaveProjectGraphDto
  ) {
    const graph = await this.graphService.saveGraph(user.sub, projectId, dto);
    return ok({ graph });
  }
}

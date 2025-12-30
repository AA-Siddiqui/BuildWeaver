import {
  Body,
  Controller,
  Get,
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
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ProjectComponentsService } from './components.service';
import { CreateProjectComponentDto } from './dto/create-project-component.dto';

@ApiTags('project-components')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/components')
export class ProjectComponentsController {
  constructor(private readonly componentsService: ProjectComponentsService) {}

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Lists saved UI components for the project' })
  async list(@CurrentUser() user: AuthUser, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const components = await this.componentsService.list(user.sub, projectId);
    return ok({ components });
  }

  @Post()
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Creates a reusable UI component for the project' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateProjectComponentDto
  ) {
    const component = await this.componentsService.create(user.sub, projectId, dto);
    return ok({ component });
  }

  @Get(':componentId')
  @ApiResponse({ status: HttpStatus.OK, description: 'Fetches a single project component' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('componentId', new ParseUUIDPipe()) componentId: string
  ) {
    const component = await this.componentsService.findOne(user.sub, projectId, componentId);
    return ok({ component });
  }
}

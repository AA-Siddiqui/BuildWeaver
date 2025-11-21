import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectPagesService } from './pages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ok } from '../../common/api-response';
import { CreateProjectPageDto } from './dto/create-project-page.dto';
import { UpdateProjectPageDto } from './dto/update-project-page.dto';

@ApiTags('project-pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/pages')
export class ProjectPagesController {
  constructor(private readonly pagesService: ProjectPagesService) {}

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Lists pages for the project' })
  async list(@CurrentUser() user: AuthUser, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const pages = await this.pagesService.list(user.sub, projectId);
    return ok({ pages });
  }

  @Post()
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Creates a new page in the project' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateProjectPageDto
  ) {
    const page = await this.pagesService.create(user.sub, projectId, dto);
    return ok({ page });
  }

  @Get(':pageId')
  @ApiResponse({ status: HttpStatus.OK, description: 'Fetches a single project page' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('pageId', new ParseUUIDPipe()) pageId: string
  ) {
    const page = await this.pagesService.findOne(user.sub, projectId, pageId);
    return ok({ page });
  }

  @Put(':pageId')
  @ApiResponse({ status: HttpStatus.OK, description: 'Updates a project page' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('pageId', new ParseUUIDPipe()) pageId: string,
    @Body() dto: UpdateProjectPageDto
  ) {
    const page = await this.pagesService.update(user.sub, projectId, pageId, dto);
    return ok({ page });
  }
}

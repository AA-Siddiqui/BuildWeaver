import { Body, Controller, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ok } from '../../common/api-response';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ApplyDatabaseSchemaDto } from './dto/apply-database-schema.dto';
import { IntrospectDatabaseSchemaDto } from './dto/introspect-database-schema.dto';
import { ProjectDatabasesService } from './project-databases.service';

@ApiTags('project-databases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/databases')
export class ProjectDatabasesController {
  constructor(private readonly databases: ProjectDatabasesService) {}

  @Post('apply')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Applies the provided database schema to the configured Postgres instance'
  })
  async applySchema(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() schema: ApplyDatabaseSchemaDto
  ) {
    const result = await this.databases.applySchema(user.sub, projectId, schema);
    return ok({ applied: true, statements: result.statements });
  }

  @Post('introspect')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pulls the current schema from the configured Postgres instance'
  })
  async introspect(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() payload: IntrospectDatabaseSchemaDto
  ) {
    const result = await this.databases.introspectSchema(user.sub, projectId, payload);
    return ok(result);
  }
}

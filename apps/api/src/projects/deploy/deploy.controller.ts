import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { ok } from '../../common/api-response';
import { ProjectDeployService } from './deploy.service';
import { CheckSubdomainAvailabilityDto } from './dto/check-subdomain-availability.dto';
import { DeployProjectDto } from './dto/deploy-project.dto';

@ApiTags('project-deploy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/deploy')
export class ProjectDeployController {
  constructor(private readonly deployService: ProjectDeployService) {}

  @Post('availability')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Checks whether the requested preview subdomain is available',
  })
  @HttpCode(HttpStatus.OK)
  async checkAvailability(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CheckSubdomainAvailabilityDto,
  ) {
    const availability = await this.deployService.checkSubdomainAvailability(
      user.sub,
      projectId,
      dto.deploymentName,
    );

    return ok({ availability });
  }

  @Post()
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Builds and deploys a preview bundle via SSH and docker compose',
  })
  @HttpCode(HttpStatus.OK)
  async deploy(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: DeployProjectDto,
  ) {
    const deployment = await this.deployService.deployProject(
      user.sub,
      projectId,
      dto,
    );

    return ok({ deployment });
  }
}

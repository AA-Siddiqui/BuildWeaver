import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectGraphController } from './graph/graph.controller';
import { ProjectGraphService } from './graph/graph.service';
import { ProjectPagesController } from './pages/pages.controller';
import { ProjectPagesService } from './pages/pages.service';

@Module({
  controllers: [ProjectsController, ProjectGraphController, ProjectPagesController],
  providers: [ProjectsService, ProjectGraphService, ProjectPagesService]
})
export class ProjectsModule {}

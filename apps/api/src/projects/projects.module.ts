import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectGraphController } from './graph/graph.controller';
import { ProjectGraphService } from './graph/graph.service';
import { ProjectPagesController } from './pages/pages.controller';
import { ProjectPagesService } from './pages/pages.service';
import { ProjectComponentsController } from './components/components.controller';
import { ProjectComponentsService } from './components/components.service';
import { ProjectDatabasesController } from './databases/project-databases.controller';
import { ProjectDatabasesService } from './databases/project-databases.service';
import { ProjectAiController } from './ai/ai.controller';
import { ProjectAiService } from './ai/ai.service';

@Module({
  controllers: [ProjectsController, ProjectGraphController, ProjectPagesController, ProjectComponentsController, ProjectDatabasesController, ProjectAiController],
  providers: [ProjectsService, ProjectGraphService, ProjectPagesService, ProjectComponentsService, ProjectDatabasesService, ProjectAiService]
})
export class ProjectsModule {}

import type { CodegenAdapter } from '../core/adapter';
import type { GeneratedFile } from '../core/bundle';
import { createBundle } from '../core/bundle';
import { normalizeProject } from '../core/normalize';
import { createScaffoldFiles } from './express/scaffold';
import { createServerFiles } from './express/server-emitter';
import { createDbFiles } from './express/db-emitter';
import { createQueryFiles } from './express/query-emitter';
import { createRouteFiles } from './express/route-emitter';

const LOG_PREFIX = '[Codegen:ExpressAdapter]';

export const ExpressAdapter: CodegenAdapter = {
  name: 'express-api',
  target: 'express-api',
  async generate(ir) {
    console.info(`${LOG_PREFIX} Starting Express API generation for "${ir.metadata.name}"`);

    const project = normalizeProject(ir);
    const databases = project.databases ?? [];
    const queries = project.queries ?? [];
    const connections = project.pageQueryConnections ?? [];
    const files: GeneratedFile[] = [];

    console.info(`${LOG_PREFIX} Project summary:`, {
      pages: project.pages.length,
      databases: databases.length,
      queries: queries.length,
      connections: connections.length,
    });

    console.info(`${LOG_PREFIX} Generating scaffold files`);
    files.push(...createScaffoldFiles(project));

    console.info(`${LOG_PREFIX} Generating server files`);
    files.push(...createServerFiles(databases));

    console.info(`${LOG_PREFIX} Generating database files`);
    files.push(...createDbFiles(databases));

    console.info(`${LOG_PREFIX} Generating query files`);
    files.push(...createQueryFiles(queries));

    console.info(`${LOG_PREFIX} Generating route files`);
    files.push(...createRouteFiles(project));

    const bundle = createBundle('express-api', files, {
      irVersion: project.version,
      summary: `Express API for ${project.metadata.name}`,
      entryFile: 'src/index.ts',
      metadata: {
        pages: project.pages.length,
        databases: databases.length,
        queries: queries.length,
        routes: project.pages.length,
      },
    });

    console.info(
      `${LOG_PREFIX} Bundle created with ${bundle.files.length} file(s), id="${bundle.id}"`,
    );
    return bundle;
  },
};

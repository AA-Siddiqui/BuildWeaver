import type { CodegenAdapter } from '../core/adapter';
import type { GeneratedFile } from '../core/bundle';
import { createBundle } from '../core/bundle';
import { normalizeProject } from '../core/normalize';
import { emitPageComponent } from './react/page-emitter';
import { createScaffoldFiles, createRoutesFile, toComponentName } from './react/scaffold';

const LOG_PREFIX = '[Codegen:ReactAdapter]';

export const ReactAdapter: CodegenAdapter = {
  name: 'react-web',
  target: 'react-web',
  async generate(ir) {
    console.info(`${LOG_PREFIX} Starting React code generation for "${ir.metadata.name}"`);

    const project = normalizeProject(ir);
    const files: GeneratedFile[] = [];

    console.info(`${LOG_PREFIX} Generating scaffold files`);
    files.push(...createScaffoldFiles(project));

    const pageEntries = project.pages.map((page) => ({
      componentName: toComponentName(page.name),
      page
    }));

    console.info(`${LOG_PREFIX} Generating ${pageEntries.length} page component(s)`);
    for (const { componentName, page } of pageEntries) {
      const source = emitPageComponent(page, componentName);
      files.push({
        path: `src/pages/${componentName}.tsx`,
        contents: source
      });
      console.info(`${LOG_PREFIX}   - Generated src/pages/${componentName}.tsx for route "${page.route}"`);
    }

    console.info(`${LOG_PREFIX} Generating routes file`);
    files.push({
      path: 'src/routes.tsx',
      contents: createRoutesFile(pageEntries)
    });

    const bundle = createBundle('react-web', files, {
      irVersion: project.version,
      summary: `React web app for ${project.metadata.name}`,
      entryFile: 'src/main.tsx',
      metadata: {
        pages: project.pages.length
      }
    });

    console.info(`${LOG_PREFIX} Bundle created with ${bundle.files.length} file(s), id="${bundle.id}"`);
    return bundle;
  }
};

import type { Page, ProjectIR } from '@buildweaver/libs';
import type { CodegenAdapter } from '../core/adapter';
import { createBundle, GeneratedFile } from '../core/bundle';
import { normalizeProject } from '../core/normalize';

const createPackageJson = (project: ProjectIR): string =>
  JSON.stringify(
    {
      name: `${project.metadata.slug ?? 'buildweaver'}-api`,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'tsx watch src/index.ts',
        start: 'node dist/index.js',
        build: 'tsc -p tsconfig.json'
      },
      dependencies: {
        express: '^4.18.2'
      },
      devDependencies: {
        typescript: '^5.3.3',
        '@types/express': '^4.17.21',
        tsx: '^4.1.0'
      }
    },
    null,
    2
  );

const createTsconfig = (): string =>
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        moduleResolution: 'Node',
        strict: true,
        esModuleInterop: true,
        outDir: 'dist',
        resolveJsonModule: true
      },
      include: ['src']
    },
    null,
    2
  );

const createServerEntry = (): string => `import express from 'express';
import { registerRoutes } from './routes';

const app = express();
app.use(express.json());

registerRoutes(app);

const port = process.env.PORT ?? 3333;
app.listen(port, () => {
  console.log('API ready on port', port);
});
`;

const createRoutesFile = (pages: Page[]): string => {
  const handlers = pages
    .map((page) => {
      const auth = page.auth?.strategy ?? 'public';
      const payment = page.payment?.provider ?? 'none';
      return `  app.get('${page.route}', (_req, res) => {
    res.json({
      page: '${page.name}',
      requiresAuth: '${auth}',
      paymentProvider: '${payment}'
    });
  });`;
    })
    .join('\n\n');

  return `import type { Express } from 'express';

export const registerRoutes = (app: Express): void => {
${handlers || '  // No routes defined yet. Add pages to your IR to generate endpoints.'}
};
`;
};

const buildExpressFiles = (project: ProjectIR): GeneratedFile[] => {
  const pages: Page[] = project.pages.length
    ? project.pages
    : [
        {
          id: 'page.placeholder',
          name: 'Placeholder',
          route: '/placeholder',
          entry: {
            id: 'ui.placeholder',
            key: 'placeholder',
            component: 'div',
            label: 'Placeholder',
            props: { text: 'API placeholder' },
            bindings: {},
            events: [],
            children: []
          }
        }
      ];

  return [
    { path: 'package.json', contents: createPackageJson(project) },
    { path: 'tsconfig.json', contents: createTsconfig() },
    { path: 'src/index.ts', contents: createServerEntry() },
    { path: 'src/routes.ts', contents: createRoutesFile(pages) },
    {
      path: 'README.md',
      contents: `# ${project.metadata.name} Express API\n\nRoutes mirror project pages to keep contracts humane. Update the IR to change the generated endpoints.`
    }
  ];
};

export const ExpressAdapter: CodegenAdapter = {
  name: 'express-api',
  target: 'express-api',
  async generate(ir) {
    const project = normalizeProject(ir);
    const files = buildExpressFiles(project);
    return createBundle('express-api', files, {
      irVersion: project.version,
      summary: `Express API scaffold for ${project.metadata.name}`,
      entryFile: 'src/index.ts',
      metadata: {
        routes: project.pages.length
      }
    });
  }
};

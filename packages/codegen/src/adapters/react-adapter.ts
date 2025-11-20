import type { Page, ProjectIR } from '@buildweaver/libs';
import type { CodegenAdapter } from '../core/adapter';
import { createBundle, GeneratedFile } from '../core/bundle';
import { normalizeProject } from '../core/normalize';

const toComponentName = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('') || 'Page';

const createPackageJson = (project: ProjectIR): string =>
  JSON.stringify(
    {
      name: project.metadata.slug ?? 'buildweaver-react-app',
      private: true,
      version: '0.1.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.21.1'
      },
      devDependencies: {
        typescript: '^5.3.3',
        vite: '^5.0.0'
      }
    },
    null,
    2
  );

const createMainFile = (): string => `import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

const router = createBrowserRouter(routes);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
`;

const createRoutesFile = (pages: Page[]): string => {
  const imports = pages
    .map((page) => `import { ${toComponentName(page.name)} } from './pages/${toComponentName(page.name)}';`)
    .join('\n');
  const routeEntries = pages
    .map(
      (page) =>
        `  {
    path: '${page.route}',
    element: <${toComponentName(page.name)} />
  }`
    )
    .join(',\n');

  return `import type { RouteObject } from 'react-router-dom';
${imports}

export const routes: RouteObject[] = [
${routeEntries}
];
`;
};

const createPageComponent = (page: Page, accentColor: string): string => `import React from 'react';

export const ${toComponentName(page.name)}: React.FC = () => {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section style={{ borderTop: '4px solid ${accentColor}', padding: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600 }}>${page.name}</h1>
        <p style={{ marginTop: '0.5rem' }}>
          Generated from BuildWeaver node "${page.entry.component}". Update the IR to change this JSX in a predictable way.
        </p>
      </section>
    </main>
  );
};
`;

const buildReactFiles = (project: ProjectIR): GeneratedFile[] => {
  const accent = project.theme?.colors?.primary ?? '#D34E4E';
  const pages: Page[] = project.pages.length
    ? project.pages
    : [
        {
          id: 'page.placeholder',
          name: 'Placeholder',
          route: '/',
          entry: {
            id: 'ui.placeholder',
            key: 'placeholder',
            component: 'div',
            label: 'Placeholder',
            props: { text: 'Welcome to BuildWeaver' },
            bindings: {},
            events: [],
            children: []
          }
        }
      ];

  const files: GeneratedFile[] = [
    {
      path: 'package.json',
      contents: createPackageJson(project)
    },
    {
      path: 'src/main.tsx',
      contents: createMainFile()
    },
    {
      path: 'src/routes.tsx',
      contents: createRoutesFile(pages as Page[])
    },
    {
      path: 'README.md',
      contents: `# ${project.metadata.name} (React target)\n\nThis project was generated from the BuildWeaver IR.\n- Pages: ${pages.length}\n- Logic nodes: ${project.logic.nodes.length}\n\nUpdate the IR and regenerate to keep this code human editable.`
    }
  ];

  pages.forEach((page) => {
    files.push({
      path: `src/pages/${toComponentName(page.name)}.tsx`,
      contents: createPageComponent(page as Page, accent)
    });
  });

  return files;
};

export const ReactAdapter: CodegenAdapter = {
  name: 'react-web',
  target: 'react-web',
  async generate(ir) {
    const project = normalizeProject(ir);
    const files = buildReactFiles(project);
    return createBundle('react-web', files, {
      irVersion: project.version,
      summary: `React web scaffold for ${project.metadata.name}`,
      entryFile: 'src/main.tsx',
      metadata: {
        pages: project.pages.length
      }
    });
  }
};

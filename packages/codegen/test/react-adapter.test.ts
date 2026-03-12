import JSZip from 'jszip';
import { createEmptyProject } from '@buildweaver/libs';
import type { ProjectIR, Page } from '@buildweaver/libs';
import { ReactAdapter, bundleToZip } from '../src';
import type { GeneratedBundle } from '../src';

const minimalEntry = {
  id: 'ui-root',
  key: 'root',
  component: 'Main',
  label: 'Main',
  props: {},
  bindings: {},
  events: [],
  children: []
};

const makePage = (name: string, route: string, overrides?: Partial<Page>): Page => ({
  id: `page-${name.toLowerCase().replace(/\s/g, '-')}`,
  name,
  route,
  entry: minimalEntry,
  ...overrides
});

const makeProjectWithPages = (pages: Page[]): ProjectIR => {
  const project = createEmptyProject('Test Project');
  project.pages = pages;
  return project;
};

describe('ReactAdapter', () => {
  it('has the correct name and target', () => {
    expect(ReactAdapter.name).toBe('react-web');
    expect(ReactAdapter.target).toBe('react-web');
  });

  describe('generate', () => {
    let bundle: GeneratedBundle;

    beforeAll(async () => {
      const project = makeProjectWithPages([
        makePage('Home', '/'),
        makePage('About', '/about')
      ]);
      bundle = await ReactAdapter.generate(project);
    });

    it('produces a bundle with an id', () => {
      expect(bundle.id).toBeTruthy();
    });

    it('produces a bundle manifest with correct adapter name', () => {
      expect(bundle.manifest.adapter).toBe('react-web');
    });

    it('includes entry file in manifest', () => {
      expect(bundle.manifest.entryFile).toBe('src/main.tsx');
    });

    it('includes page count in metadata', () => {
      expect(bundle.manifest.metadata?.pages).toBe(2);
    });

    it('includes all scaffold files', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('package.json');
      expect(paths).toContain('vite.config.ts');
      expect(paths).toContain('tsconfig.json');
      expect(paths).toContain('tsconfig.node.json');
      expect(paths).toContain('index.html');
      expect(paths).toContain('.env.example');
      expect(paths).toContain('src/main.tsx');
      expect(paths).toContain('src/hooks/usePageData.ts');
      expect(paths).toContain('src/styles/global.css');
      expect(paths).toContain('README.md');
    });

    it('generates a page component file per page', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/pages/Home.tsx');
      expect(paths).toContain('src/pages/About.tsx');
    });

    it('generates a routes file', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/routes.tsx');
    });

    it('produces valid JSON in package.json', () => {
      const pkgFile = bundle.files.find((f) => f.path === 'package.json');
      expect(pkgFile).toBeDefined();
      const pkg = JSON.parse(pkgFile!.contents as string);
      expect(pkg.dependencies.react).toBeTruthy();
      expect(pkg.dependencies['react-dom']).toBeTruthy();
      expect(pkg.dependencies['react-router-dom']).toBeTruthy();
      expect(pkg.devDependencies.vite).toBeTruthy();
      expect(pkg.devDependencies.typescript).toBeTruthy();
      expect(pkg.devDependencies['@vitejs/plugin-react']).toBeTruthy();
      expect(pkg.devDependencies['@types/react']).toBeTruthy();
    });

    it('includes correct routes for all pages', () => {
      const routesFile = bundle.files.find((f) => f.path === 'src/routes.tsx');
      expect(routesFile).toBeDefined();
      const content = routesFile!.contents as string;
      expect(content).toContain("path: '/'");
      expect(content).toContain("path: '/about'");
      expect(content).toContain('import { Home }');
      expect(content).toContain('import { About }');
    });

    it('includes env example with VITE_API_BASE_URL', () => {
      const envFile = bundle.files.find((f) => f.path === '.env.example');
      expect(envFile).toBeDefined();
      expect(envFile!.contents as string).toContain('VITE_API_BASE_URL');
    });

    it('includes global CSS with responsive stacking utilities', () => {
      const cssFile = bundle.files.find((f) => f.path === 'src/styles/global.css');
      expect(cssFile).toBeDefined();
      const content = cssFile!.contents as string;
      expect(content).toContain('.bw-stack-md');
      expect(content).toContain('.bw-stack-lg');
      expect(content).toContain('box-sizing: border-box');
    });

    it('usePageData hook fetches from VITE_API_BASE_URL', () => {
      const hookFile = bundle.files.find((f) => f.path === 'src/hooks/usePageData.ts');
      expect(hookFile).toBeDefined();
      const content = hookFile!.contents as string;
      expect(content).toContain('VITE_API_BASE_URL');
      expect(content).toContain('/api/page-data/');
      expect(content).toContain('useEffect');
      expect(content).toContain('useState');
    });

    it('main.tsx sets up RouterProvider', () => {
      const mainFile = bundle.files.find((f) => f.path === 'src/main.tsx');
      expect(mainFile).toBeDefined();
      const content = mainFile!.contents as string;
      expect(content).toContain('RouterProvider');
      expect(content).toContain('createBrowserRouter');
      expect(content).toContain("import { routes } from './routes'");
    });
  });

  describe('generate with builderState (Puck data)', () => {
    it('generates page with component JSX when builderState is present', async () => {
      const project = makeProjectWithPages([
        makePage('Landing', '/', {
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Heading',
                props: { id: 'h1', content: 'Welcome to BuildWeaver', size: 'h1' }
              },
              {
                type: 'Paragraph',
                props: { id: 'p1', content: 'Build apps visually.' }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/Landing.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('Welcome to BuildWeaver');
      expect(content).toContain('Build apps visually.');
      expect(content).toContain('<h1');
      expect(content).toContain('<p');
      expect(content).toContain('<main');
    });

    it('generates loading/error states when dynamic bindings are used', async () => {
      const project = makeProjectWithPages([
        makePage('Profile', '/profile', {
          dynamicInputs: [
            { id: 'user-name', label: 'User Name', dataType: 'string' }
          ],
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Heading',
                props: {
                  id: 'h1',
                  content: { __bwDynamicBinding: true, bindingId: 'user-name' }
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/Profile.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain("import { usePageData }");
      expect(content).toContain('loading');
      expect(content).toContain('error');
      expect(content).toContain('pageData?.User_Name');
    });

    it('generates placeholder page when builderState is absent', async () => {
      const project = makeProjectWithPages([
        makePage('Empty', '/empty')
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/Empty.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('Empty');
      expect(content).toContain('BuildWeaver');
    });
  });

  describe('generate with inline slot children (Puck v0.16+ format)', () => {
    it('generates Section with nested children from inline contentSlot', async () => {
      const project = makeProjectWithPages([
        makePage('SlotTest', '/slot-test', {
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Section',
                props: {
                  id: 'sec-1',
                  heading: 'Section Title',
                  contentSlot: [
                    { type: 'Heading', props: { id: 'nested-h1', content: 'Nested Heading', size: 'h2' } },
                    { type: 'Paragraph', props: { id: 'nested-p1', content: 'Nested paragraph text.' } }
                  ]
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/SlotTest.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('Section Title');
      expect(content).toContain('Nested Heading');
      expect(content).toContain('Nested paragraph text.');
      expect(content).toContain('<section');
      expect(content).toContain('<h2');
    });

    it('generates Columns with inline left/right slot children', async () => {
      const project = makeProjectWithPages([
        makePage('ColumnsTest', '/columns-test', {
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Columns',
                props: {
                  id: 'col-1',
                  layout: 'equal',
                  left: [
                    { type: 'Heading', props: { id: 'left-h', content: 'Left Column Content' } }
                  ],
                  right: [
                    { type: 'Paragraph', props: { id: 'right-p', content: 'Right Column Content' } }
                  ]
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/ColumnsTest.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('Left Column Content');
      expect(content).toContain('Right Column Content');
      expect(content).toContain('gridTemplateColumns');
    });

    it('generates deeply nested inline slots (Section > Columns > Heading)', async () => {
      const project = makeProjectWithPages([
        makePage('DeepNest', '/deep', {
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Section',
                props: {
                  id: 'outer-sec',
                  heading: 'Outer Section',
                  contentSlot: [
                    {
                      type: 'Columns',
                      props: {
                        id: 'inner-col',
                        layout: 'wideLeft',
                        left: [
                          { type: 'Heading', props: { id: 'deep-h', content: 'Deeply Nested Title', size: 'h3' } }
                        ],
                        right: [
                          { type: 'Button', props: { id: 'deep-btn', label: 'Deep Button' } }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/DeepNest.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('Outer Section');
      expect(content).toContain('Deeply Nested Title');
      expect(content).toContain('Deep Button');
      expect(content).toContain('<h3');
    });

    it('generates Conditional with inline case slot children', async () => {
      const project = makeProjectWithPages([
        makePage('CondTest', '/cond-test', {
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Conditional',
                props: {
                  id: 'cond-1',
                  activeCaseKey: 'active',
                  cases: [
                    {
                      caseKey: 'active',
                      slot: [
                        { type: 'Heading', props: { id: 'case-h', content: 'Active Case Content' } }
                      ]
                    },
                    {
                      caseKey: 'inactive',
                      slot: [
                        { type: 'Paragraph', props: { id: 'case-p', content: 'Inactive Content' } }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/CondTest.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('Active Case Content');
      // Inactive case should not be rendered (static case key)
      expect(content).not.toContain('Inactive Content');
    });

    it('generates List with inline customItemSlot children', async () => {
      const project = makeProjectWithPages([
        makePage('ListTest', '/list-test', {
          dynamicInputs: [
            { id: 'items', label: 'Items', dataType: 'list' }
          ],
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'List',
                props: {
                  id: 'list-1',
                  renderMode: 'custom',
                  dataSource: { __bwDynamicBinding: true, bindingId: 'items' },
                  customItemSlot: [
                    { type: 'Heading', props: { id: 'slot-h', content: 'Item Header' } }
                  ]
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/ListTest.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      expect(content).toContain('.map(');
      expect(content).toContain('Item Header');
      expect(content).toContain('pageData?.Items');
    });

    it('detects dynamic bindings inside inline slot children', async () => {
      const project = makeProjectWithPages([
        makePage('BindingSlot', '/binding-slot', {
          dynamicInputs: [
            { id: 'title-input', label: 'Page Title', dataType: 'string' }
          ],
          builderState: {
            root: { props: {} },
            content: [
              {
                type: 'Section',
                props: {
                  id: 'sec-1',
                  contentSlot: [
                    {
                      type: 'Heading',
                      props: {
                        id: 'bound-h',
                        content: { __bwDynamicBinding: true, bindingId: 'title-input' }
                      }
                    }
                  ]
                }
              }
            ]
          }
        })
      ]);

      const bundle = await ReactAdapter.generate(project);
      const pageFile = bundle.files.find((f) => f.path === 'src/pages/BindingSlot.tsx');
      expect(pageFile).toBeDefined();

      const content = pageFile!.contents as string;
      // Should detect the dynamic binding inside the slot and import usePageData
      expect(content).toContain("import { usePageData }");
      expect(content).toContain('pageData?.Page_Title');
    });
  });

  describe('component name generation', () => {
    it('converts page names with spaces to PascalCase', async () => {
      const project = makeProjectWithPages([
        makePage('my cool page', '/my-cool-page')
      ]);
      const bundle = await ReactAdapter.generate(project);
      expect(bundle.files.some((f) => f.path === 'src/pages/MyCoolPage.tsx')).toBe(true);
    });

    it('converts page names with special characters', async () => {
      const project = makeProjectWithPages([
        makePage('hello-world!', '/hello-world')
      ]);
      const bundle = await ReactAdapter.generate(project);
      expect(bundle.files.some((f) => f.path === 'src/pages/HelloWorld.tsx')).toBe(true);
    });
  });

  describe('ZIP output', () => {
    it('creates a valid ZIP archive containing all bundle files', async () => {
      const project = makeProjectWithPages([
        makePage('Home', '/'),
        makePage('Contact', '/contact')
      ]);
      const bundle = await ReactAdapter.generate(project);
      const zipArtifact = await bundleToZip(bundle, 'test-output.zip');

      expect(zipArtifact.fileName).toBe('test-output.zip');
      expect(zipArtifact.buffer).toBeInstanceOf(Buffer);
      expect(zipArtifact.buffer.length).toBeGreaterThan(0);

      const zip = await JSZip.loadAsync(zipArtifact.buffer);
      const zipFiles = Object.keys(zip.files);

      expect(zipFiles).toContain('package.json');
      expect(zipFiles).toContain('src/pages/Home.tsx');
      expect(zipFiles).toContain('src/pages/Contact.tsx');
      expect(zipFiles).toContain('src/routes.tsx');
      expect(zipFiles).toContain('src/main.tsx');
      expect(zipFiles).toContain('src/hooks/usePageData.ts');
    });

    it('ZIP file contents match bundle file contents', async () => {
      const project = makeProjectWithPages([
        makePage('Home', '/')
      ]);
      const bundle = await ReactAdapter.generate(project);
      const zipArtifact = await bundleToZip(bundle);
      const zip = await JSZip.loadAsync(zipArtifact.buffer);

      const pkgBundleContent = bundle.files.find((f) => f.path === 'package.json')?.contents;
      const pkgZipContent = await zip.file('package.json')?.async('string');
      expect(pkgZipContent).toBe(pkgBundleContent);
    });

    it('generates a default zip file name based on adapter and id', async () => {
      const project = makeProjectWithPages([makePage('Home', '/')]);
      const bundle = await ReactAdapter.generate(project);
      const zipArtifact = await bundleToZip(bundle);
      expect(zipArtifact.fileName).toContain('react-web');
      expect(zipArtifact.fileName).toContain(bundle.id);
      expect(zipArtifact.fileName).toMatch(/\.zip$/);
    });
  });
});

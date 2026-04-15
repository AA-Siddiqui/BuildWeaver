import JSZip from 'jszip';
import { createEmptyProject } from '@buildweaver/libs';
import type { Page, ProjectIR } from '@buildweaver/libs';
import { FlutterAdapter, bundleToZip } from '../src';
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
  const project = createEmptyProject('Flutter Generation Test');
  project.pages = pages;
  return project;
};

describe('FlutterAdapter', () => {
  it('has the correct name and target', () => {
    expect(FlutterAdapter.name).toBe('flutter');
    expect(FlutterAdapter.target).toBe('flutter');
  });

  describe('generate', () => {
    let bundle: GeneratedBundle;

    beforeAll(async () => {
      const project = makeProjectWithPages([
        makePage('Page One', '/page-1', {
          builderState: {
            root: { id: 'root', props: {}, children: [] },
            content: [
              {
                type: 'Section',
                props: {
                  id: 'section-1',
                  heading: 'Welcome',
                  subheading: 'Generated from BuildWeaver'
                }
              }
            ]
          },
          dynamicInputs: [
            {
              id: 'users',
              label: 'Users',
              dataType: 'list',
              listItemType: 'object',
              sampleValue: [
                {
                  name: 'Ada Lovelace',
                  age: 36
                }
              ]
            }
          ]
        }),
        makePage('Page Two', '/page-2', {
          builderState: {
            root: { id: 'root', props: {}, children: [] },
            content: [
              {
                type: 'Heading',
                props: {
                  id: 'heading-1',
                  content: {
                    __bwDynamicBinding: true,
                    bindingId: 'site-title'
                  }
                }
              }
            ]
          },
          dynamicInputs: [
            {
              id: 'site-title',
              label: 'Site Title',
              dataType: 'string',
              sampleValue: 'BuildWeaver'
            }
          ]
        })
      ]);

      bundle = await FlutterAdapter.generate(project);
    });

    it('produces a bundle with an id', () => {
      expect(bundle.id).toBeTruthy();
    });

    it('produces a bundle manifest with correct adapter', () => {
      expect(bundle.manifest.adapter).toBe('flutter');
    });

    it('includes main entry file in manifest', () => {
      expect(bundle.manifest.entryFile).toBe('lib/main.dart');
    });

    it('includes all required project scaffold files', () => {
      const paths = bundle.files.map((file) => file.path);

      expect(paths).toContain('pubspec.yaml');
      expect(paths).toContain('analysis_options.yaml');
      expect(paths).toContain('.gitignore');
      expect(paths).toContain('.env');
      expect(paths).toContain('.env.example');
      expect(paths).toContain('.metadata');
      expect(paths).toContain('README.md');
      expect(paths).toContain('lib/main.dart');
      expect(paths).toContain('lib/config/app_env.dart');
      expect(paths).toContain('lib/data/page_data_client.dart');
      expect(paths).toContain('lib/models/generated_models.dart');
      expect(paths).toContain('lib/generated/project_manifest.dart');
      expect(paths).toContain('lib/render/page_renderer.dart');
    });

    it('creates one page file per IR page', () => {
      const paths = bundle.files.map((file) => file.path);
      expect(paths).toContain('lib/pages/page_1_page.dart');
      expect(paths).toContain('lib/pages/page_2_page.dart');
    });

    it('configures go_router and preserves page routes in main.dart', () => {
      const mainFile = bundle.files.find((file) => file.path === 'lib/main.dart');
      expect(mainFile).toBeDefined();
      const content = mainFile!.contents as string;

      expect(content).toContain("import 'package:go_router/go_router.dart';");
      expect(content).toContain("path: '/page-1'");
      expect(content).toContain("path: '/page-2'");
      expect(content).toContain('GoRouter(');
      expect(content).toContain('MaterialApp.router');
    });

    it('includes environment-based API base URL configuration', () => {
      const envExample = bundle.files.find((file) => file.path === '.env.example');
      const appEnv = bundle.files.find((file) => file.path === 'lib/config/app_env.dart');
      const pageDataClient = bundle.files.find((file) => file.path === 'lib/data/page_data_client.dart');

      expect(envExample).toBeDefined();
      expect(envExample!.contents as string).toContain('API_BASE_URL=http://localhost:3000');

      expect(appEnv).toBeDefined();
      expect(appEnv!.contents as string).toContain("dotenv.env['API_BASE_URL']");

      expect(pageDataClient).toBeDefined();
      expect(pageDataClient!.contents as string).toContain('/api/page-data/');
      expect(pageDataClient!.contents as string).toContain('AppEnv.apiBaseUrl');
    });

    it('includes required flutter dependencies in pubspec.yaml', () => {
      const pubspec = bundle.files.find((file) => file.path === 'pubspec.yaml');
      expect(pubspec).toBeDefined();
      const content = pubspec!.contents as string;

      expect(content).toContain('go_router:');
      expect(content).toContain('http:');
      expect(content).toContain('flutter_dotenv:');
      expect(content).toContain('url_launcher:');
      expect(content).toContain('assets:');
      expect(content).toContain('- .env');
    });

    it('writes generated page manifest with dynamic input metadata', () => {
      const manifest = bundle.files.find((file) => file.path === 'lib/generated/project_manifest.dart');
      expect(manifest).toBeDefined();
      const content = manifest!.contents as string;

      expect(content).toContain("route: '/page-1'");
      expect(content).toContain("route: '/page-2'");
      expect(content).toContain("label: 'Users'");
      expect(content).toContain("label: 'Site Title'");
      expect(content).toContain('builderStateBase64');
    });

    it('renders pages via a runtime renderer with component switch support', () => {
      const renderer = bundle.files.find((file) => file.path === 'lib/render/page_renderer.dart');
      expect(renderer).toBeDefined();
      const content = renderer!.contents as string;

      expect(content).toContain('class GeneratedPageRenderer extends StatefulWidget');
      expect(content).toContain("case 'Section':");
      expect(content).toContain("case 'Columns':");
      expect(content).toContain("case 'Heading':");
      expect(content).toContain("case 'Paragraph':");
      expect(content).toContain("case 'Button':");
      expect(content).toContain("case 'Image':");
      expect(content).toContain("case 'Card':");
      expect(content).toContain("case 'List':");
      expect(content).toContain("case 'Divider':");
      expect(content).toContain("case 'Spacer':");
      expect(content).toContain("case 'Conditional':");
      expect(content).toContain('_resolveDynamicValue');
      expect(content).toContain('debugPrint');
    });
  });

  describe('zip output', () => {
    it('produces a zip containing all generated flutter files', async () => {
      const project = makeProjectWithPages([
        makePage('Zip One', '/zip-one'),
        makePage('Zip Two', '/zip-two')
      ]);

      const bundle = await FlutterAdapter.generate(project);
      const artifact = await bundleToZip(bundle, 'flutter.zip');
      const zip = await JSZip.loadAsync(artifact.buffer);
      const zipFiles = Object.keys(zip.files);

      expect(artifact.fileName).toBe('flutter.zip');
      expect(zipFiles).toContain('pubspec.yaml');
      expect(zipFiles).toContain('lib/main.dart');
      expect(zipFiles).toContain('lib/pages/zip_one_page.dart');
      expect(zipFiles).toContain('lib/pages/zip_two_page.dart');
      expect(zipFiles).toContain('lib/render/page_renderer.dart');
      expect(zipFiles).toContain('lib/generated/project_manifest.dart');
      expect(zipFiles).toContain('lib/data/page_data_client.dart');
      expect(zipFiles).toContain('.env.example');
    });
  });
});

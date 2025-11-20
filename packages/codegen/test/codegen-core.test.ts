import JSZip from 'jszip';
import type { ProjectIR } from '@buildweaver/libs';
import { createEmptyProject } from '@buildweaver/libs';
import {
  AdapterRegistry,
  CodegenAdapter,
  createAdapterRunner,
  createBundle,
  bundleToZip,
  ReactAdapter
} from '../src';

const stubAdapter = (capture: (ir: ProjectIR) => void): CodegenAdapter => ({
  name: 'stub',
  target: 'react-web',
  async generate(ir) {
    capture(ir);
    return createBundle('stub', [], {
      irVersion: ir.version,
      summary: 'stub bundle'
    });
  }
});

describe('Codegen core', () => {
  it('normalizes IR before invoking adapters', async () => {
    const project = createEmptyProject('Normalize Test');
    const pageB = {
      id: 'page-b',
      name: 'Page B',
      route: '/b',
      entry: {
        id: 'ui-b',
        key: 'b',
        component: 'div',
        label: 'B',
        props: {},
        bindings: {},
        events: [],
        children: []
      }
    };
    const pageA = {
      ...pageB,
      id: 'page-a',
      name: 'Page A',
      route: '/a'
    };
    project.pages = [pageB, pageA];

    let captured: ProjectIR | undefined;
    const adapter = stubAdapter((ir) => {
      captured = ir;
    });

    const run = createAdapterRunner(adapter);
    await run(project);

    expect(captured).toBeDefined();
    expect(captured?.pages[0]?.route).toBe('/a');
  });

  it('registers adapters and generates zips', async () => {
    const project = createEmptyProject('React Target');
    project.pages = [
      {
        id: 'page.home',
        name: 'Home',
        route: '/',
        entry: {
          id: 'ui.home',
          key: 'home',
          component: 'Main',
          label: 'Main',
          props: { title: 'Home' },
          bindings: {},
          events: [],
          children: []
        }
      }
    ];

    const registry = new AdapterRegistry();
    registry.register(ReactAdapter);

    const bundle = await registry.get('react-web').generate(project);
    expect(bundle.files.some((file) => file.path.includes('src/pages'))).toBe(true);

    const zipArtifact = await bundleToZip(bundle, 'react.zip');
    const zip = await JSZip.loadAsync(zipArtifact.buffer);
    expect(Object.keys(zip.files)).toContain('src/pages/Home.tsx');
  });
});

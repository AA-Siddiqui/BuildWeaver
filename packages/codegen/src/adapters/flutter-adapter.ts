import type { Page, ProjectIR } from '@buildweaver/libs';
import type { CodegenAdapter } from '../core/adapter';
import { createBundle, GeneratedFile } from '../core/bundle';
import { normalizeProject } from '../core/normalize';

const toClassName = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('') || 'PageView';

const createPubspec = (project: ProjectIR): string => `name: ${
  project.metadata.slug ?? 'buildweaver_flutter'
}
description: Generated from BuildWeaver IR
version: 0.1.0
publish_to: 'none'
environment:
  sdk: '>=3.1.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6
dev_dependencies:
  flutter_test:
    sdk: flutter
flutter:
  uses-material-design: true
`;

const createMainFile = (pages: Page[]): string => {
  const routes = pages
    .map(
      (page) =>
        `        '${page.route}': (context) => ${toClassName(page.name)}Screen()`
    )
    .join(',\n');

  return `import 'package:flutter/material.dart';
${pages
  .map((page) => "import 'pages/" + toClassName(page.name).toLowerCase() + ".dart';")
  .join('\n')}

void main() {
  runApp(const GeneratedApp());
}

class GeneratedApp extends StatelessWidget {
  const GeneratedApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BuildWeaver',
      initialRoute: '${pages[0]?.route ?? '/'}',
      routes: {
${routes}
      },
    );
  }
}
`;
};

const createPageFile = (page: Page): string => {
  const className = `${toClassName(page.name)}Screen`;
  return `import 'package:flutter/material.dart';

class ${className} extends StatelessWidget {
  const ${className}({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${page.name}')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Text('Wire this widget to the BuildWeaver IR to render ${page.entry.component} nodes.'),
      ),
    );
  }
}
`;
};

const buildFlutterFiles = (project: ProjectIR): GeneratedFile[] => {
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
            component: 'Container',
            label: 'Placeholder',
            props: { text: 'Placeholder' },
            bindings: {},
            events: [],
            children: []
          }
        }
      ];

  const files: GeneratedFile[] = [
    { path: 'pubspec.yaml', contents: createPubspec(project) },
    { path: 'lib/main.dart', contents: createMainFile(pages) },
    {
      path: 'README.md',
      contents: `# ${project.metadata.name} Flutter Target\n\nPages generated: ${pages.length}. Extend the generated widgets to reflect the IR tree.`
    }
  ];

  pages.forEach((page) => {
    files.push({
      path: `lib/pages/${toClassName(page.name).toLowerCase()}.dart`,
      contents: createPageFile(page)
    });
  });

  return files;
};

export const FlutterAdapter: CodegenAdapter = {
  name: 'flutter',
  target: 'flutter',
  async generate(ir) {
    const project = normalizeProject(ir);
    const files = buildFlutterFiles(project);
    return createBundle('flutter', files, {
      irVersion: project.version,
      summary: `Flutter scaffold for ${project.metadata.name}`,
      entryFile: 'lib/main.dart',
      metadata: {
        pages: project.pages.length
      }
    });
  }
};

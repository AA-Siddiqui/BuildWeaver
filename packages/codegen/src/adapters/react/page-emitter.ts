import type { Page } from '@buildweaver/libs';
import type { PageDynamicInputInfo, PuckData } from './types';
import { collectPageBindings } from './binding-resolver';
import { emitContentArray } from './component-emitter';
import { normalizePuckSlots } from './slot-normalizer';

const LOG_PREFIX = '[Codegen:PageEmitter]';

const buildDynamicInputInfoList = (page: Page): PageDynamicInputInfo[] =>
  (page.dynamicInputs ?? []).map((input) => ({
    id: input.id,
    label: input.label,
    dataType: input.dataType
  }));

export const emitPageComponent = (page: Page, componentName: string): string => {
  const rawPuckData = page.builderState as PuckData | undefined;
  const dynamicInputs = buildDynamicInputInfoList(page);

  console.info(`${LOG_PREFIX} Generating page component "${componentName}" for route "${page.route}"`);
  console.info(`${LOG_PREFIX}   - Dynamic inputs: ${dynamicInputs.length}`);
  console.info(`${LOG_PREFIX}   - Has builder state: ${Boolean(rawPuckData)}`);

  if (!rawPuckData?.content) {
    console.info(`${LOG_PREFIX}   - No Puck data available, generating placeholder`);
    return emitPlaceholderPage(page, componentName);
  }

  // Normalize inline slot data (Puck v0.16+ stores slot children inline in
  // component props) into the top-level zones map for the emitter to consume.
  const puckData = normalizePuckSlots(rawPuckData);

  const bindingIds = collectPageBindings(puckData);
  const hasDynamicBindings = bindingIds.size > 0;

  console.info(`${LOG_PREFIX}   - Dynamic bindings found: ${bindingIds.size}`);
  console.info(`${LOG_PREFIX}   - Content components: ${puckData.content.length}`);
  console.info(`${LOG_PREFIX}   - Zones (after normalization): ${Object.keys(puckData.zones ?? {}).length}`);

  const imports: string[] = ["import React from 'react';"];
  if (hasDynamicBindings) {
    imports.push("import { usePageData } from '../hooks/usePageData';");
  }

  const slug = page.route.replace(/^\//, '') || 'index';

  const bodyJsx = emitContentArray(
    puckData.content,
    puckData.zones ?? {},
    dynamicInputs,
    6
  );

  const hookLine = hasDynamicBindings
    ? `\n  const { data: pageData, loading, error } = usePageData('${slug}');\n\n  if (loading) {\n    return (\n      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "system-ui" }}>\n        Loading...\n      </div>\n    );\n  }\n\n  if (error) {\n    return (\n      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#ef4444", fontFamily: "system-ui" }}>\n        Error: {error}\n      </div>\n    );\n  }\n`
    : '';

  return `${imports.join('\n')}

export const ${componentName}: React.FC = () => {${hookLine}
  return (
    <main style={{ minHeight: "100vh" }}>
${bodyJsx}
    </main>
  );
};
`;
};

const emitPlaceholderPage = (page: Page, componentName: string): string => {
  console.info(`${LOG_PREFIX} Emitting placeholder for "${componentName}"`);

  const accentColor = '#D34E4E';
  return `import React from 'react';

export const ${componentName}: React.FC = () => {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#1e293b" }}>
      <section style={{ borderTop: "4px solid ${accentColor}", padding: "2rem" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 600 }}>${page.name}</h1>
        <p style={{ marginTop: "0.5rem" }}>
          Generated from BuildWeaver node &quot;${page.entry.component}&quot;.
          Update the page in the BuildWeaver editor to populate this component.
        </p>
      </section>
    </main>
  );
};
`;
};

import type {
  Page,
  PageQueryConnection,
  ProjectIR,
  QueryDefinition,
} from '@buildweaver/libs';
import type { GeneratedFile } from '../../core/bundle';
import { toFunctionName, httpMethodForMode } from './query-emitter';

const LOG_PREFIX = '[Codegen:Express:Route]';

/* ── Naming helpers ───────────────────────────────────────────────── */

const routeToSlug = (route: string): string =>
  route
    .replace(/^\/+/, '')
    .replace(/\/+$/, '') || 'index';

const routeToFileName = (route: string): string =>
  routeToSlug(route).replace(/\//g, '-') || 'index';

const toPropertyKey = (label: string): string =>
  label.replace(/[^a-zA-Z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'data';

/* ── Per-page route file ──────────────────────────────────────────── */

interface PageRouteDeps {
  page: Page;
  connections: PageQueryConnection[];
  queryMap: Map<string, QueryDefinition>;
  hasDatabases: boolean;
}

const emitPageRouteFile = (deps: PageRouteDeps): string => {
  const { page, connections, queryMap, hasDatabases } = deps;
  const slug = routeToSlug(page.route);

  const readConns = connections.filter((c) => c.queryMode === 'read');
  const writeConns = connections.filter((c) => c.queryMode !== 'read');

  const needsDb = hasDatabases && connections.length > 0;
  const dbImport = needsDb
    ? "import { getPool } from '../db/connections';\n"
    : '';
  const queryImports = connections
    .map((c) => {
      const q = queryMap.get(c.queryId);
      return q ? toFunctionName(q.name) : null;
    })
    .filter(Boolean);
  const uniqueQueryImports = [...new Set(queryImports)];
  const queryImportLine =
    uniqueQueryImports.length > 0
      ? `import { ${uniqueQueryImports.join(', ')} } from '../queries';\n`
      : '';

  let code = `import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
${dbImport}${queryImportLine}
const router = Router();

`;

  // GET handler (always present – serves page data)
  code += emitGetHandler(page, slug, readConns, queryMap, needsDb);

  // Mutation handlers (POST, PUT, DELETE)
  const modeGroups = new Map<string, PageQueryConnection[]>();
  for (const conn of writeConns) {
    const list = modeGroups.get(conn.queryMode) ?? [];
    list.push(conn);
    modeGroups.set(conn.queryMode, list);
  }

  for (const [mode, conns] of modeGroups) {
    code += emitMutationHandler(page, slug, mode, conns, queryMap, needsDb);
  }

  code += `export default router;\n`;
  return code;
};

const emitGetHandler = (
  page: Page,
  slug: string,
  readConns: PageQueryConnection[],
  queryMap: Map<string, QueryDefinition>,
  needsDb: boolean,
): string => {
  const dynamicInputs = page.dynamicInputs ?? [];
  const inputComments =
    dynamicInputs.length > 0
      ? dynamicInputs
          .map((inp) => ` *   - ${inp.label} (${inp.dataType})`)
          .join('\n')
      : ' *   (none)';

  let body: string;

  if (readConns.length > 0 && needsDb) {
    const queries = readConns
      .map((conn) => {
        const q = queryMap.get(conn.queryId);
        if (!q) return null;
        const fnName = toFunctionName(q.name);
        const key = toPropertyKey(conn.inputLabel || q.name);
        return { fnName, key, schemaId: conn.schemaId };
      })
      .filter(Boolean) as Array<{ fnName: string; key: string; schemaId: string }>;

    const poolIds = [...new Set(queries.map((q) => q.schemaId))];
    const poolDecls = poolIds
      .map((id) => `    const pool_${id.replace(/[^a-zA-Z0-9]/g, '_')} = getPool('${id}');`)
      .join('\n');

    const queryExecs = queries
      .map(
        (q) =>
          `    const ${q.key}Result = await ${q.fnName}(pool_${q.schemaId.replace(/[^a-zA-Z0-9]/g, '_')}, req.query as Record<string, unknown>);`,
      )
      .join('\n');

    const responseFields = queries
      .map((q) => `      ${q.key}: ${q.key}Result.rows,`)
      .join('\n');

    body = `${poolDecls}

${queryExecs}

    console.info(\`[${slug}] GET: Returning data for ${queries.length} input(s)\`);
    res.json({
${responseFields}
    });`;
  } else if (dynamicInputs.length > 0) {
    const placeholders = dynamicInputs
      .map((inp) => `      ${toPropertyKey(inp.label)}: null, // TODO: wire to data source`)
      .join('\n');
    body = `    console.info('[${slug}] GET: Returning placeholder data');
    res.json({
${placeholders}
    });`;
  } else {
    body = `    console.info('[${slug}] GET: Returning page confirmation');
    res.json({ page: '${page.name}', status: 'ok' });`;
  }

  return `/**
 * GET /api/page-data/${slug}
 * Page: "${page.name}" (route: ${page.route})
 * Dynamic inputs:
${inputComments}
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  console.info('[${slug}] GET: Fetching page data');
  try {
${body}
  } catch (error) {
    console.error('[${slug}] GET: Error fetching page data:', error);
    next(error);
  }
});

`;
};

const emitMutationHandler = (
  page: Page,
  slug: string,
  mode: string,
  conns: PageQueryConnection[],
  queryMap: Map<string, QueryDefinition>,
  needsDb: boolean,
): string => {
  const method = httpMethodForMode(mode);
  const METHOD = method.toUpperCase();

  if (!needsDb || conns.length === 0) {
    return `/**
 * ${METHOD} /api/page-data/${slug}
 * Mode: ${mode}
 */
router.${method}('/', async (req: Request, res: Response, next: NextFunction) => {
  console.info('[${slug}] ${METHOD}: Received ${mode} request');
  try {
    // TODO: wire to data source
    console.warn('[${slug}] ${METHOD}: No database configured for this operation');
    res.json({ success: true });
  } catch (error) {
    console.error('[${slug}] ${METHOD}: Error:', error);
    next(error);
  }
});

`;
  }

  const queries = conns
    .map((conn) => {
      const q = queryMap.get(conn.queryId);
      if (!q) return null;
      return { fnName: toFunctionName(q.name), schemaId: conn.schemaId, name: q.name };
    })
    .filter(Boolean) as Array<{ fnName: string; schemaId: string; name: string }>;

  const poolIds = [...new Set(queries.map((q) => q.schemaId))];
  const poolDecls = poolIds
    .map((id) => `    const pool_${id.replace(/[^a-zA-Z0-9]/g, '_')} = getPool('${id}');`)
    .join('\n');

  const execLines = queries
    .map(
      (q) =>
        `    const ${q.fnName}Result = await ${q.fnName}(pool_${q.schemaId.replace(/[^a-zA-Z0-9]/g, '_')}, req.body);`,
    )
    .join('\n');

  const responseData = queries
    .map((q) => `      ${q.fnName}Result: ${q.fnName}Result.rows,`)
    .join('\n');

  return `/**
 * ${METHOD} /api/page-data/${slug}
 * Mode: ${mode}
 * Queries: ${queries.map((q) => q.name).join(', ')}
 */
router.${method}('/', async (req: Request, res: Response, next: NextFunction) => {
  console.info('[${slug}] ${METHOD}: Received ${mode} request');
  try {
${poolDecls}

${execLines}

    console.info('[${slug}] ${METHOD}: Operation completed');
    res.json({
      success: true,
${responseData}
    });
  } catch (error) {
    console.error('[${slug}] ${METHOD}: Error:', error);
    next(error);
  }
});

`;
};

/* ── Route index file ─────────────────────────────────────────────── */

const createRouteIndexFile = (pages: Page[]): string => {
  if (pages.length === 0) {
    return `import type { Express } from 'express';

export const registerRoutes = (app: Express): void => {
  console.info('[Routes] Registering routes (0 page endpoints)');

  app.get('/health', (_req, res) => {
    console.info('[Routes] Health check');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  console.info('[Routes] No page endpoints configured');
};
`;
  }

  const imports = pages
    .map((p) => {
      const name = routeToFileName(p.route);
      return `import ${name.replace(/[^a-zA-Z0-9]/g, '_')}Router from './${name}';`;
    })
    .join('\n');

  const mounts = pages
    .map((p) => {
      const slug = routeToSlug(p.route);
      const name = routeToFileName(p.route);
      return `  app.use('/api/page-data/${slug}', ${name.replace(/[^a-zA-Z0-9]/g, '_')}Router);
  console.info('[Routes]   /api/page-data/${slug} -> ${p.name}');`;
    })
    .join('\n');

  return `import type { Express } from 'express';
${imports}

export const registerRoutes = (app: Express): void => {
  console.info('[Routes] Registering routes (${pages.length} page endpoint(s))');

  app.get('/health', (_req, res) => {
    console.info('[Routes] Health check');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

${mounts}

  console.info('[Routes] All routes registered');
};
`;
};

/* ── Public API ───────────────────────────────────────────────────── */

export const createRouteFiles = (project: ProjectIR): GeneratedFile[] => {
  const pages = project.pages;
  const queries = project.queries ?? [];
  const connections = project.pageQueryConnections ?? [];
  const hasDatabases = (project.databases?.length ?? 0) > 0;

  const queryMap = new Map<string, QueryDefinition>(
    queries.map((q) => [q.id, q]),
  );

  console.info(
    `${LOG_PREFIX} Creating route files for ${pages.length} page(s), ${connections.length} connection(s)`,
  );

  const files: GeneratedFile[] = [
    { path: 'src/routes/index.ts', contents: createRouteIndexFile(pages) },
  ];

  for (const page of pages) {
    const pageConns = connections.filter((c) => c.pageId === page.id);
    const fileName = routeToFileName(page.route);

    console.info(
      `${LOG_PREFIX}   route: ${page.route} -> src/routes/${fileName}.ts (${pageConns.length} query connection(s))`,
    );

    files.push({
      path: `src/routes/${fileName}.ts`,
      contents: emitPageRouteFile({
        page,
        connections: pageConns,
        queryMap,
        hasDatabases,
      }),
    });
  }

  return files;
};

export { routeToSlug, routeToFileName, toPropertyKey };

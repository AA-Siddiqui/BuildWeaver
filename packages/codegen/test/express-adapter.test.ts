import JSZip from 'jszip';
import { createEmptyProject } from '@buildweaver/libs';
import type { ProjectIR, Page } from '@buildweaver/libs';
import type { DatabaseSchema, QueryDefinition } from '@buildweaver/libs';
import { ExpressAdapter, bundleToZip } from '../src';
import type { GeneratedBundle } from '../src';

/* ── Helpers ──────────────────────────────────────────────────────── */

const minimalEntry = {
  id: 'ui-root',
  key: 'root',
  component: 'Main',
  label: 'Main',
  props: {},
  bindings: {},
  events: [],
  children: [],
};

const makePage = (
  name: string,
  route: string,
  overrides?: Partial<Page>,
): Page => ({
  id: `page-${name.toLowerCase().replace(/\s/g, '-')}`,
  name,
  route,
  entry: minimalEntry,
  ...overrides,
});

const makeDatabase = (
  name: string,
  tables: DatabaseSchema['tables'] = [],
  connection?: DatabaseSchema['connection'],
): DatabaseSchema => ({
  id: `db-${name.toLowerCase().replace(/\s/g, '-')}`,
  name,
  tables,
  relationships: [],
  connection: connection ?? {
    host: 'localhost',
    port: 5432,
    database: name.toLowerCase().replace(/\s/g, '_'),
    user: 'postgres',
    password: 'secret',
  },
});

const makeQuery = (
  name: string,
  mode: QueryDefinition['mode'],
  schemaId: string,
  tableName: string,
  selectedColumns: string[] = [],
): QueryDefinition => ({
  id: `query-${name.toLowerCase().replace(/\s/g, '-')}`,
  name,
  mode,
  schemaId,
  nodes: [
    {
      id: 'qt-1',
      type: 'query-table',
      position: { x: 0, y: 0 },
      data: {
        kind: 'query-table',
        tableId: 'table-1',
        tableName,
        schemaId,
        selectedColumns,
        columnDefaults: {},
        aggregationInputCount: 0,
      },
    },
  ],
  edges: [],
  arguments: [],
});

const makeProject = (overrides?: Partial<ProjectIR>): ProjectIR => ({
  ...createEmptyProject('Test Project'),
  ...overrides,
});

/* ── ExpressAdapter identity ──────────────────────────────────────── */

describe('ExpressAdapter', () => {
  it('has the correct name and target', () => {
    expect(ExpressAdapter.name).toBe('express-api');
    expect(ExpressAdapter.target).toBe('express-api');
  });

  /* ── Minimal project (no pages, no databases) ────────────────── */

  describe('generate with empty project', () => {
    let bundle: GeneratedBundle;

    beforeAll(async () => {
      bundle = await ExpressAdapter.generate(makeProject());
    });

    it('produces a bundle with an id', () => {
      expect(bundle.id).toBeTruthy();
    });

    it('sets adapter name in manifest', () => {
      expect(bundle.manifest.adapter).toBe('express-api');
    });

    it('sets entry file to src/index.ts', () => {
      expect(bundle.manifest.entryFile).toBe('src/index.ts');
    });

    it('includes scaffold files', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('package.json');
      expect(paths).toContain('tsconfig.json');
      expect(paths).toContain('.gitignore');
      expect(paths).toContain('README.md');
    });

    it('includes server files', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/index.ts');
      expect(paths).toContain('src/config.ts');
      expect(paths).toContain('src/middleware/error-handler.ts');
      expect(paths).toContain('.env');
      expect(paths).toContain('.env.example');
    });

    it('includes database connection stub', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/db/connections.ts');
    });

    it('includes query stub', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/queries/index.ts');
    });

    it('includes route index', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/routes/index.ts');
    });

    it('generates valid JSON in package.json', () => {
      const pkgFile = bundle.files.find((f) => f.path === 'package.json');
      expect(pkgFile).toBeDefined();
      const pkg = JSON.parse(pkgFile!.contents as string);
      expect(pkg.dependencies.express).toBeTruthy();
      expect(pkg.dependencies.cors).toBeTruthy();
      expect(pkg.dependencies.dotenv).toBeTruthy();
      expect(pkg.scripts.dev).toBeTruthy();
      expect(pkg.scripts.build).toBeTruthy();
    });

    it('does not include pg when no databases', () => {
      const pkgFile = bundle.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.contents as string);
      expect(pkg.dependencies.pg).toBeUndefined();
      expect(pkg.devDependencies['@types/pg']).toBeUndefined();
    });

    it('generates valid JSON in tsconfig.json', () => {
      const tsFile = bundle.files.find((f) => f.path === 'tsconfig.json');
      expect(tsFile).toBeDefined();
      const ts = JSON.parse(tsFile!.contents as string);
      expect(ts.compilerOptions.target).toBe('ES2020');
      expect(ts.compilerOptions.strict).toBe(true);
      expect(ts.include).toContain('src');
    });

    it('stub connections file throws on getPool', () => {
      const file = bundle.files.find(
        (f) => f.path === 'src/db/connections.ts',
      );
      expect(file).toBeDefined();
      expect(file!.contents as string).toContain('not configured');
    });
  });

  /* ── Project with pages ──────────────────────────────────────── */

  describe('generate with pages', () => {
    let bundle: GeneratedBundle;

    beforeAll(async () => {
      bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Home', '/'),
            makePage('Products', '/products'),
            makePage('About Us', '/about-us'),
          ],
        }),
      );
    });

    it('generates a route file per page', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/routes/index.ts');
      expect(paths).toContain('src/routes/products.ts');
      expect(paths).toContain('src/routes/about-us.ts');
    });

    it('generates index route for / page', () => {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/routes/index.ts');
    });

    it('route index registers all pages', () => {
      const routeIndex = bundle.files.find(
        (f) => f.path === 'src/routes/index.ts',
      );
      expect(routeIndex).toBeDefined();
      const content = routeIndex!.contents as string;
      expect(content).toContain('/api/page-data/products');
      expect(content).toContain('/api/page-data/about-us');
    });

    it('route index includes health check', () => {
      const routeIndex = bundle.files.find(
        (f) => f.path === 'src/routes/index.ts',
      );
      const content = routeIndex!.contents as string;
      expect(content).toContain('/health');
    });

    it('page route files contain GET handler', () => {
      const productsRoute = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      expect(productsRoute).toBeDefined();
      const content = productsRoute!.contents as string;
      expect(content).toContain("router.get('/'");
      expect(content).toContain('Products');
    });

    it('page route files include logging', () => {
      const productsRoute = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      const content = productsRoute!.contents as string;
      expect(content).toContain('console.info');
      expect(content).toContain('[products]');
    });

    it('page route files have error handling', () => {
      const productsRoute = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      const content = productsRoute!.contents as string;
      expect(content).toContain('catch');
      expect(content).toContain('next(error)');
    });

    it('sets page count in manifest metadata', () => {
      expect(bundle.manifest.metadata?.pages).toBe(3);
    });
  });

  /* ── Project with pages that have dynamic inputs ────────────── */

  describe('generate with dynamic inputs', () => {
    let bundle: GeneratedBundle;

    beforeAll(async () => {
      bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Dashboard', '/dashboard', {
              dynamicInputs: [
                { id: 'user-name', label: 'User Name', dataType: 'string' },
                { id: 'stats', label: 'Stats', dataType: 'object' },
              ],
            }),
          ],
        }),
      );
    });

    it('route handler references dynamic inputs in comments', () => {
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/dashboard.ts',
      );
      expect(route).toBeDefined();
      const content = route!.contents as string;
      expect(content).toContain('User Name');
      expect(content).toContain('Stats');
    });

    it('route handler returns placeholder data for unconnected inputs', () => {
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/dashboard.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('User_Name');
      expect(content).toContain('null');
      expect(content).toContain('TODO');
    });
  });

  /* ── Dummy node sample values in dynamic inputs ──────────────── */

  describe('generate with dummy node sample values', () => {
    it('emits integer sample value instead of null', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Metrics', '/metrics', {
              dynamicInputs: [
                { id: 'user-count', label: 'User Count', dataType: 'number', sampleValue: 42 },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/metrics.ts',
      );
      expect(route).toBeDefined();
      const content = route!.contents as string;
      expect(content).toContain('User_Count: 42,');
      expect(content).not.toContain('User_Count: null');
    });

    it('emits string sample value instead of null', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Profile', '/profile', {
              dynamicInputs: [
                { id: 'site-name', label: 'Site Name', dataType: 'string', sampleValue: 'My App' },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/profile.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Site_Name: "My App",');
      expect(content).not.toContain('Site_Name: null');
    });

    it('emits boolean sample value instead of null', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Settings', '/settings', {
              dynamicInputs: [
                { id: 'is-active', label: 'Is Active', dataType: 'boolean', sampleValue: true },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/settings.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Is_Active: true,');
      expect(content).not.toContain('Is_Active: null');
    });

    it('emits list sample value instead of null', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Tags', '/tags', {
              dynamicInputs: [
                { id: 'tag-list', label: 'Tag List', dataType: 'list', sampleValue: ['alpha', 'beta', 'gamma'] },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/tags.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Tag_List: ["alpha","beta","gamma"],');
      expect(content).not.toContain('Tag_List: null');
    });

    it('emits object sample value instead of null', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Config', '/config', {
              dynamicInputs: [
                {
                  id: 'app-config',
                  label: 'App Config',
                  dataType: 'object',
                  sampleValue: { theme: 'dark', version: 2 },
                },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/config.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('App_Config: {"theme":"dark","version":2},');
      expect(content).not.toContain('App_Config: null');
    });

    it('emits null sample value when sampleValue is explicitly null', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Empty', '/empty', {
              dynamicInputs: [
                { id: 'nullable', label: 'Nullable Field', dataType: 'string', sampleValue: null },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/empty.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Nullable_Field: null,');
      // Should NOT have the TODO comment since sampleValue was explicitly set
      expect(content).not.toContain('TODO');
    });

    it('handles multiple inputs with different sample types', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Dashboard', '/dashboard', {
              dynamicInputs: [
                { id: 'count', label: 'Count', dataType: 'number', sampleValue: 100 },
                { id: 'title', label: 'Title', dataType: 'string', sampleValue: 'Hello World' },
                { id: 'active', label: 'Active', dataType: 'boolean', sampleValue: false },
                { id: 'items', label: 'Items', dataType: 'list', sampleValue: [1, 2, 3] },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/dashboard.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Count: 100,');
      expect(content).toContain('Title: "Hello World",');
      expect(content).toContain('Active: false,');
      expect(content).toContain('Items: [1,2,3],');
      expect(content).not.toContain('TODO');
    });

    it('mixes sample values with unresolved inputs', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Mixed', '/mixed', {
              dynamicInputs: [
                { id: 'resolved', label: 'Resolved', dataType: 'number', sampleValue: 7 },
                { id: 'unresolved', label: 'Unresolved', dataType: 'string' },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/mixed.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Resolved: 7,');
      expect(content).toContain('Unresolved: null');
      expect(content).toContain('TODO');
    });

    it('logs sample data source in generated comments', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Info', '/info', {
              dynamicInputs: [
                { id: 'data', label: 'Data', dataType: 'number', sampleValue: 99 },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/info.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('[sample]');
      expect(content).toContain('from sample data');
    });

    it('mixes query-connected inputs with sample value inputs', async () => {
      const db = makeDatabase('Shop DB', [
        {
          id: 'table-products',
          name: 'products',
          fields: [
            { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'f2', name: 'name', type: 'string', nullable: false, unique: false },
          ],
        },
      ]);
      const readQuery = makeQuery('Get Products', 'read', db.id, 'products', ['id', 'name']);

      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Products', '/products', {
              dynamicInputs: [
                { id: 'product-list', label: 'Product List', dataType: 'list' },
                { id: 'page-title', label: 'Page Title', dataType: 'string', sampleValue: 'Our Products' },
              ],
            }),
          ],
          databases: [db],
          queries: [readQuery],
          pageQueryConnections: [
            {
              pageId: 'page-products',
              queryId: readQuery.id,
              inputId: 'product-list',
              inputLabel: 'Product List',
              queryMode: 'read',
              schemaId: db.id,
            },
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      expect(route).toBeDefined();
      const content = route!.contents as string;

      // Query-connected input uses query result
      expect(content).toContain('executeGetProducts');
      expect(content).toContain('Product_List');
      expect(content).toContain('Product_ListResult.rows');

      // Dummy-connected input uses sample value
      expect(content).toContain('Page_Title: "Our Products",');

      // Both sources mentioned in log
      expect(content).toContain('from queries');
      expect(content).toContain('from sample data');
    });

    it('decimal sample value is emitted correctly', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Pricing', '/pricing', {
              dynamicInputs: [
                { id: 'price', label: 'Price', dataType: 'number', sampleValue: 9.99 },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/pricing.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Price: 9.99,');
    });

    it('zero and empty-string sample values are emitted (not treated as undefined)', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Zeros', '/zeros', {
              dynamicInputs: [
                { id: 'zero-num', label: 'Zero Num', dataType: 'number', sampleValue: 0 },
                { id: 'empty-str', label: 'Empty Str', dataType: 'string', sampleValue: '' },
                { id: 'false-bool', label: 'False Bool', dataType: 'boolean', sampleValue: false },
              ],
            }),
          ],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/zeros.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('Zero_Num: 0,');
      expect(content).toContain('Empty_Str: "",');
      expect(content).toContain('False_Bool: false,');
      // None should fall through to TODO/null
      expect(content).not.toContain('TODO');
    });
  });

  /* ── Project with databases ──────────────────────────────────── */

  describe('generate with databases', () => {
    let bundle: GeneratedBundle;
    const db = makeDatabase('Main DB', [
      {
        id: 'table-products',
        name: 'products',
        fields: [
          { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
          { id: 'f2', name: 'name', type: 'string', nullable: false, unique: false },
          { id: 'f3', name: 'price', type: 'number', nullable: false, unique: false },
        ],
      },
    ]);

    beforeAll(async () => {
      bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Products', '/products')],
          databases: [db],
        }),
      );
    });

    it('includes pg dependency', () => {
      const pkgFile = bundle.files.find((f) => f.path === 'package.json');
      const pkg = JSON.parse(pkgFile!.contents as string);
      expect(pkg.dependencies.pg).toBeTruthy();
      expect(pkg.devDependencies['@types/pg']).toBeTruthy();
    });

    it('config file references database env vars', () => {
      const config = bundle.files.find((f) => f.path === 'src/config.ts');
      expect(config).toBeDefined();
      const content = config!.contents as string;
      expect(content).toContain('MAIN_DB_HOST');
      expect(content).toContain('MAIN_DB_PORT');
      expect(content).toContain('MAIN_DB_NAME');
      expect(content).toContain('MAIN_DB_USER');
      expect(content).toContain('MAIN_DB_PASSWORD');
    });

    it('.env file has pre-filled database config', () => {
      const envFile = bundle.files.find((f) => f.path === '.env');
      expect(envFile).toBeDefined();
      const content = envFile!.contents as string;
      expect(content).toContain('MAIN_DB_HOST=localhost');
      expect(content).toContain('MAIN_DB_PORT=5432');
      expect(content).toContain('MAIN_DB_USER=postgres');
      expect(content).toContain('MAIN_DB_PASSWORD=secret');
    });

    it('.env.example has empty placeholders', () => {
      const envEx = bundle.files.find((f) => f.path === '.env.example');
      expect(envEx).toBeDefined();
      const content = envEx!.contents as string;
      expect(content).toContain('MAIN_DB_HOST=localhost');
      expect(content).toContain('MAIN_DB_PASSWORD=');
      expect(content).not.toContain('secret');
    });

    it('connections file uses Pool from pg', () => {
      const conn = bundle.files.find(
        (f) => f.path === 'src/db/connections.ts',
      );
      expect(conn).toBeDefined();
      const content = conn!.contents as string;
      expect(content).toContain("import { Pool } from 'pg'");
      expect(content).toContain('initDatabases');
      expect(content).toContain('getPool');
      expect(content).toContain('closeDatabases');
    });

    it('server entry imports database functions', () => {
      const entry = bundle.files.find((f) => f.path === 'src/index.ts');
      expect(entry).toBeDefined();
      const content = entry!.contents as string;
      expect(content).toContain('initDatabases');
      expect(content).toContain('closeDatabases');
    });

    it('server entry includes CORS middleware', () => {
      const entry = bundle.files.find((f) => f.path === 'src/index.ts');
      const content = entry!.contents as string;
      expect(content).toContain('cors');
      expect(content).toContain('express.json');
    });

    it('server entry includes request logging', () => {
      const entry = bundle.files.find((f) => f.path === 'src/index.ts');
      const content = entry!.contents as string;
      expect(content).toContain('console.info');
      expect(content).toContain('req.method');
      expect(content).toContain('req.path');
    });

    it('server entry includes graceful shutdown', () => {
      const entry = bundle.files.find((f) => f.path === 'src/index.ts');
      const content = entry!.contents as string;
      expect(content).toContain('SIGTERM');
      expect(content).toContain('SIGINT');
      expect(content).toContain('shutdown');
    });

    it('metadata records database count', () => {
      expect(bundle.manifest.metadata?.databases).toBe(1);
    });
  });

  /* ── Multiple databases ──────────────────────────────────────── */

  describe('generate with multiple databases', () => {
    let bundle: GeneratedBundle;

    beforeAll(async () => {
      bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          databases: [
            makeDatabase('Users DB', [], {
              host: 'users-host',
              port: 5433,
              database: 'users',
              user: 'admin',
            }),
            makeDatabase('Analytics DB', [], {
              host: 'analytics-host',
              port: 5434,
              database: 'analytics',
              user: 'reader',
            }),
          ],
        }),
      );
    });

    it('config file references both database env prefixes', () => {
      const config = bundle.files.find((f) => f.path === 'src/config.ts');
      const content = config!.contents as string;
      expect(content).toContain('USERS_DB_HOST');
      expect(content).toContain('ANALYTICS_DB_HOST');
    });

    it('.env has entries for both databases', () => {
      const envFile = bundle.files.find((f) => f.path === '.env');
      const content = envFile!.contents as string;
      expect(content).toContain('USERS_DB_HOST=users-host');
      expect(content).toContain('USERS_DB_PORT=5433');
      expect(content).toContain('ANALYTICS_DB_HOST=analytics-host');
      expect(content).toContain('ANALYTICS_DB_PORT=5434');
    });

    it('metadata records both databases', () => {
      expect(bundle.manifest.metadata?.databases).toBe(2);
    });
  });

  /* ── Project with queries ────────────────────────────────────── */

  describe('generate with queries', () => {
    let bundle: GeneratedBundle;
    const db = makeDatabase('Shop DB', [
      {
        id: 'table-products',
        name: 'products',
        fields: [
          { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
          { id: 'f2', name: 'name', type: 'string', nullable: false, unique: false },
          { id: 'f3', name: 'price', type: 'number', nullable: false, unique: false },
        ],
      },
    ]);

    const readQuery = makeQuery(
      'Get Products',
      'read',
      db.id,
      'products',
      ['id', 'name', 'price'],
    );
    const insertQuery = makeQuery(
      'Create Product',
      'insert',
      db.id,
      'products',
      ['name', 'price'],
    );
    const updateQuery = makeQuery(
      'Update Product',
      'update',
      db.id,
      'products',
      ['name', 'price'],
    );
    const deleteQuery = makeQuery(
      'Delete Product',
      'delete',
      db.id,
      'products',
    );

    beforeAll(async () => {
      bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [
            makePage('Products', '/products', {
              dynamicInputs: [
                { id: 'product-list', label: 'Product List', dataType: 'list' },
              ],
            }),
          ],
          databases: [db],
          queries: [readQuery, insertQuery, updateQuery, deleteQuery],
          pageQueryConnections: [
            {
              pageId: 'page-products',
              queryId: readQuery.id,
              inputId: 'product-list',
              inputLabel: 'Product List',
              queryMode: 'read',
              schemaId: db.id,
            },
            {
              pageId: 'page-products',
              queryId: insertQuery.id,
              inputId: '',
              inputLabel: '',
              queryMode: 'insert',
              schemaId: db.id,
            },
            {
              pageId: 'page-products',
              queryId: updateQuery.id,
              inputId: '',
              inputLabel: '',
              queryMode: 'update',
              schemaId: db.id,
            },
            {
              pageId: 'page-products',
              queryId: deleteQuery.id,
              inputId: '',
              inputLabel: '',
              queryMode: 'delete',
              schemaId: db.id,
            },
          ],
        }),
      );
    });

    it('generates query functions file', () => {
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      expect(queryFile).toBeDefined();
      const content = queryFile!.contents as string;
      expect(content).toContain('executeGetProducts');
      expect(content).toContain('executeCreateProduct');
      expect(content).toContain('executeUpdateProduct');
      expect(content).toContain('executeDeleteProduct');
    });

    it('read query generates SELECT SQL', () => {
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('SELECT');
      expect(content).toContain('"products"');
      expect(content).toContain('"name"');
      expect(content).toContain('"price"');
    });

    it('insert query generates INSERT SQL', () => {
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('INSERT INTO');
      expect(content).toContain('RETURNING');
    });

    it('update query generates UPDATE SQL', () => {
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('UPDATE');
      expect(content).toContain('SET');
    });

    it('delete query generates DELETE SQL', () => {
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('DELETE FROM');
    });

    it('route file imports and uses query functions', () => {
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      expect(route).toBeDefined();
      const content = route!.contents as string;
      expect(content).toContain('executeGetProducts');
      expect(content).toContain('getPool');
    });

    it('route file has handlers for all HTTP methods', () => {
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain("router.get('/'");
      expect(content).toContain("router.post('/'");
      expect(content).toContain("router.put('/'");
      expect(content).toContain("router.delete('/'");
    });

    it('metadata records query count', () => {
      expect(bundle.manifest.metadata?.queries).toBe(4);
    });
  });

  /* ── Query SQL generation edge cases ─────────────────────────── */

  describe('query SQL generation', () => {
    it('handles query with no table nodes gracefully', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          queries: [
            {
              id: 'q-empty',
              name: 'Empty Query',
              mode: 'read',
              schemaId: 'db-1',
              nodes: [],
              edges: [],
              arguments: [],
            },
          ],
        }),
      );
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('No table defined');
    });

    it('handles query with WHERE conditions', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          queries: [
            {
              id: 'q-where',
              name: 'Filtered Products',
              mode: 'read',
              schemaId: 'db-1',
              nodes: [
                {
                  id: 'qt-1',
                  type: 'query-table',
                  position: { x: 0, y: 0 },
                  data: {
                    kind: 'query-table',
                    tableId: 't1',
                    tableName: 'products',
                    schemaId: 'db-1',
                    selectedColumns: ['id', 'name'],
                    columnDefaults: {},
                    aggregationInputCount: 0,
                  },
                },
                {
                  id: 'qw-1',
                  type: 'query-where',
                  position: { x: 0, y: 0 },
                  data: {
                    kind: 'query-where',
                    operator: '=',
                    leftOperand: 'category',
                    rightOperand: 'electronics',
                    leftIsColumn: true,
                    rightIsColumn: false,
                  },
                },
              ],
              edges: [],
              arguments: [],
            },
          ],
        }),
      );
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('WHERE');
      expect(content).toContain('"category"');
    });

    it('handles query with ORDER BY', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          queries: [
            {
              id: 'q-order',
              name: 'Ordered Products',
              mode: 'read',
              schemaId: 'db-1',
              nodes: [
                {
                  id: 'qt-1',
                  type: 'query-table',
                  position: { x: 0, y: 0 },
                  data: {
                    kind: 'query-table',
                    tableId: 't1',
                    tableName: 'products',
                    schemaId: 'db-1',
                    selectedColumns: ['name'],
                    columnDefaults: {},
                    aggregationInputCount: 0,
                  },
                },
                {
                  id: 'qo-1',
                  type: 'query-orderby',
                  position: { x: 0, y: 0 },
                  data: {
                    kind: 'query-orderby',
                    sortCount: 1,
                    sortAttributes: ['name'],
                    sortOrders: ['asc'],
                  },
                },
              ],
              edges: [],
              arguments: [],
            },
          ],
        }),
      );
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('ORDER BY');
      expect(content).toContain('"name" ASC');
    });

    it('handles query with LIMIT and OFFSET', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          queries: [
            {
              id: 'q-limit',
              name: 'Paginated Items',
              mode: 'read',
              schemaId: 'db-1',
              nodes: [
                {
                  id: 'qt-1',
                  type: 'query-table',
                  position: { x: 0, y: 0 },
                  data: {
                    kind: 'query-table',
                    tableId: 't1',
                    tableName: 'items',
                    schemaId: 'db-1',
                    selectedColumns: [],
                    columnDefaults: {},
                    aggregationInputCount: 0,
                  },
                },
                {
                  id: 'ql-1',
                  type: 'query-limit',
                  position: { x: 0, y: 0 },
                  data: {
                    kind: 'query-limit',
                    limitValue: 25,
                    offsetValue: 50,
                  },
                },
              ],
              edges: [],
              arguments: [],
            },
          ],
        }),
      );
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('LIMIT 25');
      expect(content).toContain('OFFSET 50');
    });

    it('handles insert query with selected columns', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          queries: [
            makeQuery('Add User', 'insert', 'db-1', 'users', [
              'name',
              'email',
            ]),
          ],
        }),
      );
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('INSERT INTO "users"');
      expect(content).toContain('"name"');
      expect(content).toContain('"email"');
      expect(content).toContain('$1');
      expect(content).toContain('$2');
    });
  });

  /* ── Route slug handling ─────────────────────────────────────── */

  describe('route slug handling', () => {
    it('generates correct file names for nested routes', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Settings', '/dashboard/settings')],
        }),
      );
      const paths = bundle.files.map((f) => f.path);
      expect(paths).toContain('src/routes/dashboard-settings.ts');
    });

    it('generates correct API paths for nested routes', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Settings', '/dashboard/settings')],
        }),
      );
      const routeIndex = bundle.files.find(
        (f) => f.path === 'src/routes/index.ts',
      );
      const content = routeIndex!.contents as string;
      expect(content).toContain('/api/page-data/dashboard/settings');
    });

    it('handles root route /', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
        }),
      );
      const paths = bundle.files.map((f) => f.path);
      // Root route should produce an "index" file
      const routeFiles = paths.filter((p) => p.startsWith('src/routes/'));
      expect(routeFiles.length).toBeGreaterThanOrEqual(2); // index.ts + page file
    });
  });

  /* ── Error handler middleware ─────────────────────────────────── */

  describe('error handler middleware', () => {
    it('generates error handler with stack trace logging', async () => {
      const bundle = await ExpressAdapter.generate(makeProject());
      const eh = bundle.files.find(
        (f) => f.path === 'src/middleware/error-handler.ts',
      );
      expect(eh).toBeDefined();
      const content = eh!.contents as string;
      expect(content).toContain('err.stack');
      expect(content).toContain('err.message');
      expect(content).toContain('500');
    });
  });

  /* ── Environment variable correctness ────────────────────────── */

  describe('environment variables', () => {
    it('.env contains PORT=3000 by default', async () => {
      const bundle = await ExpressAdapter.generate(makeProject());
      const env = bundle.files.find((f) => f.path === '.env');
      expect(env!.contents as string).toContain('PORT=3000');
    });

    it('.env.example does not contain real passwords', async () => {
      const db = makeDatabase('DB', [], {
        host: 'prod-host',
        port: 5432,
        database: 'prod_db',
        user: 'admin',
        password: 'super_secret_pw',
      });
      const bundle = await ExpressAdapter.generate(
        makeProject({ databases: [db] }),
      );
      const envEx = bundle.files.find((f) => f.path === '.env.example');
      expect(envEx!.contents as string).not.toContain('super_secret_pw');
    });

    it('.env pre-fills connection values from database config', async () => {
      const db = makeDatabase('Prod', [], {
        host: 'db.prod.example.com',
        port: 5433,
        database: 'myapp',
        user: 'myuser',
        password: 'mypass',
        ssl: true,
      });
      const bundle = await ExpressAdapter.generate(
        makeProject({ databases: [db] }),
      );
      const env = bundle.files.find((f) => f.path === '.env');
      const content = env!.contents as string;
      expect(content).toContain('PROD_HOST=db.prod.example.com');
      expect(content).toContain('PROD_PORT=5433');
      expect(content).toContain('PROD_NAME=myapp');
      expect(content).toContain('PROD_USER=myuser');
      expect(content).toContain('PROD_PASSWORD=mypass');
      expect(content).toContain('PROD_SSL=true');
    });
  });

  /* ── ZIP output ──────────────────────────────────────────────── */

  describe('ZIP output', () => {
    it('creates a valid ZIP archive with all files', async () => {
      const project = makeProject({
        pages: [
          makePage('Home', '/'),
          makePage('Products', '/products'),
        ],
        databases: [makeDatabase('Main', [])],
      });
      const bundle = await ExpressAdapter.generate(project);
      const zipArtifact = await bundleToZip(bundle, 'express-test.zip');

      expect(zipArtifact.fileName).toBe('express-test.zip');
      expect(zipArtifact.buffer).toBeInstanceOf(Buffer);
      expect(zipArtifact.buffer.length).toBeGreaterThan(0);

      const zip = await JSZip.loadAsync(zipArtifact.buffer);
      const zipFiles = Object.keys(zip.files);

      expect(zipFiles).toContain('package.json');
      expect(zipFiles).toContain('src/index.ts');
      expect(zipFiles).toContain('src/config.ts');
      expect(zipFiles).toContain('src/db/connections.ts');
      expect(zipFiles).toContain('src/routes/index.ts');
      expect(zipFiles).toContain('src/routes/products.ts');
      expect(zipFiles).toContain('src/queries/index.ts');
      expect(zipFiles).toContain('src/middleware/error-handler.ts');
      expect(zipFiles).toContain('.env');
      expect(zipFiles).toContain('.env.example');
    });

    it('ZIP file contents match bundle file contents', async () => {
      const project = makeProject({
        pages: [makePage('Home', '/')],
      });
      const bundle = await ExpressAdapter.generate(project);
      const zipArtifact = await bundleToZip(bundle);
      const zip = await JSZip.loadAsync(zipArtifact.buffer);

      const pkgBundleContent = bundle.files.find(
        (f) => f.path === 'package.json',
      )?.contents;
      const pkgZipContent = await zip
        .file('package.json')
        ?.async('string');
      expect(pkgZipContent).toBe(pkgBundleContent);
    });

    it('generates a default zip file name with adapter and bundle id', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({ pages: [makePage('Home', '/')] }),
      );
      const zipArtifact = await bundleToZip(bundle);
      expect(zipArtifact.fileName).toContain('express-api');
      expect(zipArtifact.fileName).toContain(bundle.id);
      expect(zipArtifact.fileName).toMatch(/\.zip$/);
    });
  });

  /* ── Combined frontend + backend folder structure (simulated) ── */

  describe('combined zip structure', () => {
    it('prefixed files simulate frontend/ and backend/ folders', async () => {
      const project = makeProject({
        pages: [makePage('Home', '/')],
      });
      const bundle = await ExpressAdapter.generate(project);

      // Simulate what useCodegen does: prefix with backend/
      const prefixedFiles = bundle.files.map((f) => ({
        ...f,
        path: `backend/${f.path}`,
      }));

      for (const file of prefixedFiles) {
        expect(file.path).toMatch(/^backend\//);
      }

      const paths = prefixedFiles.map((f) => f.path);
      expect(paths).toContain('backend/package.json');
      expect(paths).toContain('backend/src/index.ts');
      expect(paths).toContain('backend/src/routes/index.ts');
    });
  });

  /* ── Logging presence in generated code ──────────────────────── */

  describe('logging in generated code', () => {
    it('server entry has informative logs', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/')],
          databases: [makeDatabase('Test DB')],
        }),
      );
      const entry = bundle.files.find((f) => f.path === 'src/index.ts');
      const content = entry!.contents as string;
      expect(content).toContain('[Server]');
      expect(content).toContain('console.info');
    });

    it('config file logs loaded configuration', async () => {
      const bundle = await ExpressAdapter.generate(makeProject());
      const config = bundle.files.find((f) => f.path === 'src/config.ts');
      const content = config!.contents as string;
      expect(content).toContain('[Config]');
      expect(content).toContain('console.info');
    });

    it('database connections file has per-connection logs', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({ databases: [makeDatabase('Log DB')] }),
      );
      const conn = bundle.files.find(
        (f) => f.path === 'src/db/connections.ts',
      );
      const content = conn!.contents as string;
      expect(content).toContain('[DB]');
      expect(content).toContain('connected successfully');
      expect(content).toContain('Failed to connect');
    });

    it('route files have per-request logs', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Products', '/products')],
        }),
      );
      const route = bundle.files.find(
        (f) => f.path === 'src/routes/products.ts',
      );
      const content = route!.contents as string;
      expect(content).toContain('console.info');
      expect(content).toContain('console.error');
    });

    it('query functions have execution logs', async () => {
      const db = makeDatabase('DB');
      const bundle = await ExpressAdapter.generate(
        makeProject({
          queries: [
            makeQuery('Get Items', 'read', db.id, 'items', ['id']),
          ],
          databases: [db],
        }),
      );
      const queryFile = bundle.files.find(
        (f) => f.path === 'src/queries/index.ts',
      );
      const content = queryFile!.contents as string;
      expect(content).toContain('[Query:Get Items]');
      expect(content).toContain('Executing');
      expect(content).toContain('Returned');
    });

    it('route index logs registration', async () => {
      const bundle = await ExpressAdapter.generate(
        makeProject({
          pages: [makePage('Home', '/'), makePage('About', '/about')],
        }),
      );
      const routeIndex = bundle.files.find(
        (f) => f.path === 'src/routes/index.ts',
      );
      const content = routeIndex!.contents as string;
      expect(content).toContain('[Routes]');
      expect(content).toContain('Registering routes');
    });
  });
});

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../ir.schema.json';
import {
  BindingReference,
  IR_VERSION,
  ProjectIR,
  createEmptyProject
} from '../src/ir';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const binding = (partial: Partial<BindingReference>): BindingReference => ({
  kind: 'data',
  nodeId: 'logic.data.fetchUser',
  ...partial
});

const sampleIr: ProjectIR = {
  version: IR_VERSION,
  metadata: {
    id: 'project_001',
    name: 'Sample Project',
    slug: 'sample-project',
    description: 'End-to-end test fixture',
    tags: ['demo'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    generator: { name: 'buildweaver', version: IR_VERSION },
    targetFrameworks: ['react-web', 'express-api'],
    defaultLocale: 'en',
    locales: ['en'],
  },
  assets: [
    {
      id: 'asset.logo',
      type: 'image',
      name: 'Logo',
      source: {
        kind: 'remote',
        uri: 'https://cdn.example.com/logo.png'
      }
    }
  ],
  dataSources: [
    {
      id: 'ds.users',
      name: 'Users API',
      driver: 'rest',
      provides: ['User'],
      config: {
        baseUrl: 'https://api.example.com',
        path: '/users',
        method: 'GET'
      }
    }
  ],
  dataModels: [
    {
      id: 'model.user',
      name: 'User',
      sourceId: 'ds.users',
      fields: [
        {
          id: 'model.user.id',
          name: 'id',
          required: true,
          type: { kind: 'scalar', scalar: 'string' }
        },
        {
          id: 'model.user.name',
          name: 'name',
          required: true,
          type: { kind: 'scalar', scalar: 'string' }
        },
        {
          id: 'model.user.avatar',
          name: 'avatar',
          required: false,
          type: { kind: 'scalar', scalar: 'image' }
        }
      ]
    }
  ],
  pages: [
    {
      id: 'page.home',
      name: 'Home',
      route: '/',
      entry: {
        id: 'ui.root',
        key: 'root',
        component: 'Layout',
        label: 'Layout',
        props: {
          title: 'Welcome',
          footer: { text: 'Docs' }
        },
        bindings: {
          title: binding({ portId: 'result', path: '0.name' })
        },
        events: [],
        children: [
          {
            id: 'ui.hero',
            key: 'hero',
            component: 'Hero',
            label: 'Hero',
            props: {
              heading: 'Team',
              description: 'LLM powered builder'
            },
            bindings: {
              heading: binding({ portId: 'result', path: '0.name' })
            },
            events: [],
            children: []
          }
        ]
      },
      auth: {
        strategy: 'public',
        providers: []
      },
      blocks: [
        {
          nodeId: 'block.auth',
          slot: 'page',
          order: 0
        }
      ]
    }
  ],
  logic: {
    nodes: [
      {
        id: 'logic.data.fetchUser',
        kind: 'data',
        label: 'Fetch User',
        handler: 'rest.fetch',
        inputs: [],
        outputs: [
          {
            id: 'result',
            name: 'result',
            type: 'User[]'
          }
        ],
        config: {
          dataSourceId: 'ds.users'
        }
      },
      {
        id: 'block.auth',
        kind: 'block',
        label: 'Auth Guard',
        handler: 'auth.guard',
        inputs: [],
        outputs: [],
        block: {
          type: 'auth-guard',
          auth: {
            strategy: 'jwt',
            providers: [
              {
                type: 'email'
              }
            ]
          }
        }
      }
    ],
    edges: []
  },
  theme: {
    colors: {
      primary: '#D34E4E'
    },
    spacingScale: [0, 4, 8, 12, 16],
    typography: {
      fontFamilies: ['Inter', 'Roboto'],
      baseSize: 16
    }
  }
};

const expectValid = (value: ProjectIR): void => {
  const result = validate(value);
  if (!result) {
    const message = ajv.errorsText(validate.errors, { separator: '\n' });
    throw new Error(message);
  }
};

describe('IR schema', () => {
  it('accepts a representative project', () => {
    expect(() => expectValid(sampleIr)).not.toThrow();
  });

  it('validates the factory output', () => {
    const minimal = createEmptyProject('Demo');
    expect(() => expectValid(minimal)).not.toThrow();
  });
});

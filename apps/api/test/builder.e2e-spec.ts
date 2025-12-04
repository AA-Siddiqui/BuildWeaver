import request from 'supertest';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './utils/create-test-app';
import type { ProjectGraphSnapshot } from '@buildweaver/libs';

describe('Builder surfaces (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let projectId: string;
  let defaultPageId: string;
  let landingPageId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const credentials = { email: 'builder@example.com', password: 'Passw0rd!' };
    const signup = await request(app.getHttpServer()).post('/auth/signup').send(credentials);
    token = signup.body.data.token;
    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Builder Playground' });
    projectId = projectRes.body.data.project.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns default graph and page for a new project', async () => {
    const graphRes = await request(app.getHttpServer())
      .get(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`);
    expect(graphRes.status).toBe(200);
    expect(graphRes.body.data.graph.nodes).toHaveLength(2);
    const pageNode = graphRes.body.data.graph.nodes.find((node: { type: string }) => node.type === 'page');
    expect(pageNode).toBeDefined();
    defaultPageId = pageNode.data.pageId;

    const pagesRes = await request(app.getHttpServer())
      .get(`/projects/${projectId}/pages`)
      .set('Authorization', `Bearer ${token}`);
    expect(pagesRes.status).toBe(200);
    expect(pagesRes.body.data.pages).toHaveLength(1);
    expect(pagesRes.body.data.pages[0].id).toBe(defaultPageId);

    const defaultPageRes = await request(app.getHttpServer())
      .get(`/projects/${projectId}/pages/${defaultPageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(defaultPageRes.status).toBe(200);
    const defaultContent = defaultPageRes.body.data.page.builderState.content;
    expect(defaultContent).toHaveLength(1);
    expect(defaultContent[0]).toMatchObject({
      type: 'Section',
      props: expect.objectContaining({ minHeight: '100vh', backgroundColor: '#FFFFFF' })
    });
  });

  it('creates additional pages and saves graph connections', async () => {
    const createPageRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/pages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Landing' });
    expect(createPageRes.status).toBe(201);
    landingPageId = createPageRes.body.data.page.id;

    const graphPayload: ProjectGraphSnapshot = {
      nodes: [
        {
          id: `dummy-${randomUUID()}`,
          type: 'dummy',
          position: { x: -150, y: 0 },
          data: { kind: 'dummy', label: 'Dummy', sample: { type: 'integer', value: 42 } }
        },
        {
          id: `page-${landingPageId}`,
          type: 'page',
          position: { x: 200, y: 0 },
          data: {
            kind: 'page',
            pageId: landingPageId,
            pageName: 'Landing',
            inputs: [
              {
                id: `list-${randomUUID()}`,
                label: 'Inline Articles',
                dataType: 'list',
                listItemType: 'object',
                objectSample: {
                  title: 'Sample',
                  author: {
                    name: 'Avery'
                  }
                }
              }
            ]
          }
        }
      ],
      edges: [],
      functions: []
    };

    const saveGraphRes = await request(app.getHttpServer())
      .put(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`)
      .send(graphPayload);
    expect(saveGraphRes.status).toBe(200);
    expect(saveGraphRes.body.data.graph.nodes).toHaveLength(2);
    expect(saveGraphRes.body.data.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: graphPayload.nodes[0].id,
          position: graphPayload.nodes[0].position
        }),
        expect.objectContaining({
          id: graphPayload.nodes[1].id,
          data: expect.objectContaining({ pageId: landingPageId })
        })
      ])
    );

    const dynamicInputs = [
      { id: randomUUID(), label: 'Hero Title', dataType: 'string' },
      {
        id: randomUUID(),
        label: 'Hero CTA',
        dataType: 'object',
        objectSample: {
          label: 'Get started',
          action: {
            href: 'https://example.com',
            target: '_blank'
          }
        }
      },
      {
        id: randomUUID(),
        label: 'Featured Articles',
        dataType: 'list',
        listItemType: 'object',
        objectSample: {
          title: 'Welcome to BuildWeaver',
          author: {
            name: 'Editor'
          }
        }
      }
    ];
    const updatePageRes = await request(app.getHttpServer())
      .put(`/projects/${projectId}/pages/${landingPageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dynamicInputs });
    expect(updatePageRes.status).toBe(200);
    expect(updatePageRes.body.data.page.dynamicInputs).toHaveLength(3);
    const savedObjectInput = updatePageRes.body.data.page.dynamicInputs.find(
      (input: { dataType: string }) => input.dataType === 'object'
    );
    expect(savedObjectInput?.objectSample).toMatchObject({
      label: 'Get started',
      action: expect.objectContaining({ href: 'https://example.com' })
    });

    const refreshedGraph = await request(app.getHttpServer())
      .get(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`);
    expect(refreshedGraph.status).toBe(200);
    const refreshedPageNode = refreshedGraph.body.data.graph.nodes.find(
      (node: { data: { pageId: string } }) => node.data.pageId === landingPageId
    );
    expect(refreshedPageNode.position).toEqual(graphPayload.nodes[1].position);
    expect(refreshedPageNode.data.inputs).toHaveLength(3);
    expect(refreshedPageNode.data.inputs.find((input: { label: string }) => input.label === 'Hero Title')).toBeDefined();
    const listInput = refreshedPageNode.data.inputs.find(
      (input: { label: string }) => input.label === 'Featured Articles'
    );
    expect(listInput).toMatchObject({ dataType: 'list', listItemType: 'object' });
    expect(listInput.objectSample).toMatchObject({ title: 'Welcome to BuildWeaver' });
  });

  it('persists conditional, logical, and relational nodes in the graph', async () => {
    expect(landingPageId).toBeDefined();
    const nodes: ProjectGraphSnapshot['nodes'] = [
      {
        id: `page-${landingPageId}`,
        type: 'page',
        position: { x: 100, y: 0 },
        data: {
          kind: 'page',
          pageId: landingPageId,
          pageName: 'Landing',
          inputs: []
        }
      },
      {
        id: `conditional-${randomUUID()}`,
        type: 'conditional',
        position: { x: -150, y: -50 },
        data: {
          kind: 'conditional',
          label: 'Gate',
          conditionSample: true,
          trueValue: 'Enabled',
          falseValue: 'Disabled',
          trueValueKind: 'string',
          falseValueKind: 'string'
        }
      },
      {
        id: `logical-${randomUUID()}`,
        type: 'logical',
        position: { x: -150, y: 50 },
        data: {
          kind: 'logical',
          label: 'All Good',
          operation: 'and',
          primarySample: true,
          secondarySample: false
        }
      },
      {
        id: `relational-${randomUUID()}`,
        type: 'relational',
        position: { x: -150, y: 150 },
        data: {
          kind: 'relational',
          label: 'Compare',
          operation: 'gt',
          leftSample: 10,
          rightSample: 4,
          leftSampleKind: 'number',
          rightSampleKind: 'number'
        }
      }
    ];

    const saveGraphRes = await request(app.getHttpServer())
      .put(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nodes, edges: [], functions: [] });

    expect(saveGraphRes.status).toBe(200);
    const savedNodes = saveGraphRes.body.data.graph.nodes;
    expect(savedNodes.find((node: { type: string }) => node.type === 'conditional')).toBeDefined();
    expect(savedNodes.find((node: { type: string }) => node.type === 'logical')).toBeDefined();
    expect(savedNodes.find((node: { type: string }) => node.type === 'relational')).toBeDefined();
  });

  it('persists user-defined functions and exposes them via the API', async () => {
    if (!landingPageId) {
      throw new Error('landingPageId not set');
    }

    const functionId = `fn-${randomUUID()}`;
    const argumentId = `arg-${randomUUID()}`;
    const returnId = `ret-${randomUUID()}`;
    const argumentNodeId = `function-argument-${randomUUID()}`;
    const returnNodeId = `function-return-${randomUUID()}`;

    const graphPayload: ProjectGraphSnapshot = {
      nodes: [
        {
          id: `function-node-${randomUUID()}`,
          type: 'function',
          position: { x: -120, y: 0 },
          data: {
            kind: 'function',
            functionId,
            functionName: 'Format hero copy',
            mode: 'applied'
          }
        },
        {
          id: `page-${landingPageId}`,
          type: 'page',
          position: { x: 200, y: 0 },
          data: {
            kind: 'page',
            pageId: landingPageId,
            pageName: 'Landing',
            routeSegment: 'landing',
            inputs: []
          }
        }
      ],
      edges: [],
      functions: [
        {
          id: functionId,
          name: 'Format hero copy',
          description: 'Uppercase the hero title',
          nodes: [
            {
              id: argumentNodeId,
              type: 'function-argument',
              position: { x: -160, y: 0 },
              data: {
                kind: 'function-argument',
                argumentId,
                name: 'title',
                type: 'string'
              }
            },
            {
              id: returnNodeId,
              type: 'function-return',
              position: { x: 160, y: 0 },
              data: {
                kind: 'function-return',
                returnId
              }
            }
          ],
          edges: [
            {
              id: `edge-${randomUUID()}`,
              source: argumentNodeId,
              sourceHandle: `function-argument-${argumentId}`,
              target: returnNodeId,
              targetHandle: `function-return-${returnId}`
            }
          ],
          arguments: [
            {
              id: argumentId,
              name: 'title',
              type: 'string'
            }
          ],
          returnsValue: true
        }
      ]
    };

    const saveGraphRes = await request(app.getHttpServer())
      .put(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`)
      .send(graphPayload);

    expect(saveGraphRes.status).toBe(200);
    const savedGraph = saveGraphRes.body.data.graph;
    expect(savedGraph.functions).toHaveLength(1);
    const savedFunction = savedGraph.functions[0];
    expect(savedFunction.arguments).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'title', type: 'string' })])
    );
    expect(savedFunction.returnsValue).toBe(true);
    const savedFunctionNode = savedGraph.nodes.find(
      (node: { type: string; data?: { functionId?: string } }) => node.type === 'function'
    );
    expect(savedFunctionNode).toBeDefined();
    expect(savedFunctionNode?.data?.functionId).toBe(functionId);

    const refreshed = await request(app.getHttpServer())
      .get(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.graph.functions).toHaveLength(1);
    expect(refreshed.body.data.graph.functions[0].id).toBe(functionId);
  });

  it('persists builder state and returns it via the API', async () => {
    expect(landingPageId).toBeDefined();
    const builderState = {
      root: {
        id: 'root',
        props: {},
        children: []
      },
      content: [
        {
          type: 'Heading',
          props: {
            id: 'Heading-1',
            content: 'Persisted'
          }
        }
      ]
    };
    const dynamicInputs = [
      {
        id: randomUUID(),
        label: 'Persisted binding',
        dataType: 'string'
      }
    ];

    const saveRes = await request(app.getHttpServer())
      .put(`/projects/${projectId}/pages/${landingPageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ builderState, dynamicInputs });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.page.builderState.content).toHaveLength(1);
    expect(saveRes.body.data.page.dynamicInputs).toHaveLength(1);

    const getRes = await request(app.getHttpServer())
      .get(`/projects/${projectId}/pages/${landingPageId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.page.builderState.content[0]).toMatchObject(builderState.content[0]);
    expect(getRes.body.data.page.dynamicInputs[0]).toMatchObject(dynamicInputs[0]);
  });
});

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
          data: { kind: 'dummy', label: 'Dummy', value: 42 }
        },
        {
          id: `page-${landingPageId}`,
          type: 'page',
          position: { x: 200, y: 0 },
          data: {
            kind: 'page',
            pageId: landingPageId,
            pageName: 'Landing',
            inputs: []
          }
        }
      ],
      edges: []
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

    const dynamicInputs = [{ id: randomUUID(), label: 'Hero Title', dataType: 'string' }];
    const updatePageRes = await request(app.getHttpServer())
      .put(`/projects/${projectId}/pages/${landingPageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dynamicInputs });
    expect(updatePageRes.status).toBe(200);
    expect(updatePageRes.body.data.page.dynamicInputs).toHaveLength(1);

    const refreshedGraph = await request(app.getHttpServer())
      .get(`/projects/${projectId}/graph`)
      .set('Authorization', `Bearer ${token}`);
    expect(refreshedGraph.status).toBe(200);
    const refreshedPageNode = refreshedGraph.body.data.graph.nodes.find(
      (node: { data: { pageId: string } }) => node.data.pageId === landingPageId
    );
    expect(refreshedPageNode.position).toEqual(graphPayload.nodes[1].position);
    expect(refreshedPageNode.data.inputs).toHaveLength(1);
    expect(refreshedPageNode.data.inputs[0].label).toBe('Hero Title');
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

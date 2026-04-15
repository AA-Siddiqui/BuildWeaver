import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './utils/create-test-app';

describe('Auth + Projects flow (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let projectId: string;
  const credentials = { email: 'owner@example.com', password: 'Sup3rSecret!' };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up a new user', async () => {
    const res = await request(app.getHttpServer()).post('/auth/signup').send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(credentials.email.toLowerCase());
    token = res.body.data.token;
  });

  it('returns the authenticated profile', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email.toLowerCase());
  });

  it('logs in with the same credentials', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send(credentials);
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token;
  });

  it('creates, updates, lists and deletes projects for the user', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Workspace MVP', description: 'Initial prototype' });
    expect(createRes.status).toBe(201);
    projectId = createRes.body.data.project.id;

    const listRes = await request(app.getHttpServer()).get('/projects').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.projects).toHaveLength(1);

    const updateRes = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.project.description).toBe('Updated description');

    const deleteRes = await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const finalList = await request(app.getHttpServer()).get('/projects').set('Authorization', `Bearer ${token}`);
    expect(finalList.body.data.projects).toHaveLength(0);
  });

  it('creates and restores project checkpoints for full project state', async () => {
    const createProjectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Checkpoint Sandbox', description: 'Checkpoint baseline' });

    expect(createProjectRes.status).toBe(201);
    const checkpointProjectId = createProjectRes.body.data.project.id as string;

    const createPageRes = await request(app.getHttpServer())
      .post(`/projects/${checkpointProjectId}/pages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Docs', slug: 'docs' });
    expect(createPageRes.status).toBe(201);
    const docsPageId = createPageRes.body.data.page.id as string;

    const createComponentRes = await request(app.getHttpServer())
      .post(`/projects/${checkpointProjectId}/components`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Badge',
        slug: 'badge',
        definition: {
          type: 'Badge',
          props: { tone: 'info', text: 'Checkpoint' }
        }
      });
    expect(createComponentRes.status).toBe(201);

    const graphRes = await request(app.getHttpServer())
      .get(`/projects/${checkpointProjectId}/graph`)
      .set('Authorization', `Bearer ${token}`);
    expect(graphRes.status).toBe(200);

    const baselineNodeId = 'dummy-checkpoint-baseline';
    const graphWithBaseline = {
      ...graphRes.body.data.graph,
      nodes: [
        ...graphRes.body.data.graph.nodes,
        {
          id: baselineNodeId,
          type: 'dummy',
          position: { x: 480, y: 120 },
          data: {
            kind: 'dummy',
            label: 'Checkpoint baseline',
            description: 'State marker before mutation',
            sample: {
              type: 'integer',
              value: 123
            }
          }
        }
      ]
    };

    const saveBaselineGraphRes = await request(app.getHttpServer())
      .put(`/projects/${checkpointProjectId}/graph`)
      .set('Authorization', `Bearer ${token}`)
      .send(graphWithBaseline);
    expect(saveBaselineGraphRes.status).toBe(200);

    const createCheckpointRes = await request(app.getHttpServer())
      .post(`/projects/${checkpointProjectId}/checkpoints`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Baseline checkpoint', description: 'Before mutation' });

    expect(createCheckpointRes.status).toBe(201);
    const checkpointId = createCheckpointRes.body.data.checkpoint.id as string;

    const mutateProjectRes = await request(app.getHttpServer())
      .patch(`/projects/${checkpointProjectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Mutated project state' });
    expect(mutateProjectRes.status).toBe(200);

    const mutatePageRes = await request(app.getHttpServer())
      .put(`/projects/${checkpointProjectId}/pages/${docsPageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Docs v2', slug: 'docs-v2' });
    expect(mutatePageRes.status).toBe(200);

    const graphWithoutBaseline = {
      ...saveBaselineGraphRes.body.data.graph,
      nodes: saveBaselineGraphRes.body.data.graph.nodes.filter((node: { id: string }) => node.id !== baselineNodeId)
    };

    const mutateGraphRes = await request(app.getHttpServer())
      .put(`/projects/${checkpointProjectId}/graph`)
      .set('Authorization', `Bearer ${token}`)
      .send(graphWithoutBaseline);
    expect(mutateGraphRes.status).toBe(200);

    const restoreRes = await request(app.getHttpServer())
      .post(`/projects/${checkpointProjectId}/checkpoints/${checkpointId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(restoreRes.status).toBe(200);

    const listProjectsRes = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token}`);
    expect(listProjectsRes.status).toBe(200);
    const restoredProject = listProjectsRes.body.data.projects.find((project: { id: string }) => project.id === checkpointProjectId);
    expect(restoredProject.description).toBe('Checkpoint baseline');

    const restoredPagesRes = await request(app.getHttpServer())
      .get(`/projects/${checkpointProjectId}/pages`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoredPagesRes.status).toBe(200);
    expect(
      restoredPagesRes.body.data.pages.some((page: { name: string; slug: string }) => page.name === 'Docs' && page.slug === 'docs')
    ).toBe(true);

    const restoredGraphRes = await request(app.getHttpServer())
      .get(`/projects/${checkpointProjectId}/graph`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoredGraphRes.status).toBe(200);
    expect(
      restoredGraphRes.body.data.graph.nodes.some((node: { id: string }) => node.id === baselineNodeId)
    ).toBe(true);

    const restoredComponentsRes = await request(app.getHttpServer())
      .get(`/projects/${checkpointProjectId}/components`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoredComponentsRes.status).toBe(200);
    expect(
      restoredComponentsRes.body.data.components.some((component: { name: string }) => component.name === 'Badge')
    ).toBe(true);

    const checkpointsListRes = await request(app.getHttpServer())
      .get(`/projects/${checkpointProjectId}/checkpoints`)
      .set('Authorization', `Bearer ${token}`);
    expect(checkpointsListRes.status).toBe(200);
    expect(checkpointsListRes.body.data.checkpoints.length).toBeGreaterThanOrEqual(1);

    const deleteProjectRes = await request(app.getHttpServer())
      .delete(`/projects/${checkpointProjectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteProjectRes.status).toBe(200);
  });
});

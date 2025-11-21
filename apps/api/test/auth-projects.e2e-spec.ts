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
});

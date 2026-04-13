import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './utils/create-test-app';

describe('Project deploy flow (e2e)', () => {
  let app: INestApplication;
  let envBackup: Record<string, string | undefined>;

  const setDeployEnv = () => {
    envBackup = {
      DEPLOY_DRY_RUN: process.env.DEPLOY_DRY_RUN,
      DEPLOY_SSH_HOST: process.env.DEPLOY_SSH_HOST,
      DEPLOY_SSH_PORT: process.env.DEPLOY_SSH_PORT,
      DEPLOY_SSH_USER: process.env.DEPLOY_SSH_USER,
      DEPLOY_SSH_PASSWORD: process.env.DEPLOY_SSH_PASSWORD,
      DEPLOY_BASE_PATH: process.env.DEPLOY_BASE_PATH,
      DEPLOY_PREVIEW_BASE_DOMAIN: process.env.DEPLOY_PREVIEW_BASE_DOMAIN,
      DEPLOY_TRAEFIK_NETWORK: process.env.DEPLOY_TRAEFIK_NETWORK,
    };

    process.env.DEPLOY_DRY_RUN = 'true';
    process.env.DEPLOY_SSH_HOST = 'preview-host.internal';
    process.env.DEPLOY_SSH_PORT = '22';
    process.env.DEPLOY_SSH_USER = 'deploy-user';
    process.env.DEPLOY_SSH_PASSWORD = 'deploy-password';
    process.env.DEPLOY_BASE_PATH = '/opt/buildweaver-preview';
    process.env.DEPLOY_PREVIEW_BASE_DOMAIN = 'preview.buildweaver.dev';
    process.env.DEPLOY_TRAEFIK_NETWORK = 'traefik-public';
  };

  const restoreDeployEnv = () => {
    Object.entries(envBackup).forEach(([key, value]) => {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };

  const signupAndCreateProject = async (
    email: string,
    projectName: string,
  ): Promise<{ token: string; projectId: string }> => {
    const password = 'Passw0rd!';
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password });

    const token = signupRes.body.data.token as string;

    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: projectName });

    return {
      token,
      projectId: projectRes.body.data.project.id as string,
    };
  };

  beforeAll(async () => {
    setDeployEnv();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    restoreDeployEnv();
  });

  it('checks subdomain availability and deploys preview in dry-run mode', async () => {
    const { token, projectId } = await signupAndCreateProject(
      'deploy-owner@example.com',
      'Deploy Playground',
    );

    const availabilityRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/deploy/availability`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deploymentName: 'My Preview App' });

    expect(availabilityRes.status).toBe(200);
    expect(availabilityRes.body.data.availability).toMatchObject({
      available: true,
      normalizedName: 'my-preview-app',
      frontendDomain: 'my-preview-app.preview.buildweaver.dev',
      backendDomain: 'api.my-preview-app.preview.buildweaver.dev',
    });

    const deployRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/deploy`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deploymentName: 'My Preview App', frontendTarget: 'react-web' });

    expect(deployRes.status).toBe(200);
    expect(deployRes.body.data.deployment).toMatchObject({
      deploymentName: 'my-preview-app',
      status: 'deployed',
      frontendDomain: 'my-preview-app.preview.buildweaver.dev',
      backendDomain: 'api.my-preview-app.preview.buildweaver.dev',
      frontendUrl: 'https://my-preview-app.preview.buildweaver.dev',
      backendUrl: 'https://api.my-preview-app.preview.buildweaver.dev',
      remotePath: '/opt/buildweaver-preview/my-preview-app',
    });
  });

  it('rejects deployment when preferred subdomain is already allocated', async () => {
    const ownerA = await signupAndCreateProject(
      'deploy-owner-a@example.com',
      'Owner A Project',
    );

    const ownerB = await signupAndCreateProject(
      'deploy-owner-b@example.com',
      'Owner B Project',
    );

    const firstDeploy = await request(app.getHttpServer())
      .post(`/projects/${ownerA.projectId}/deploy`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ deploymentName: 'shared-slot', frontendTarget: 'react-web' });

    expect(firstDeploy.status).toBe(200);

    const availabilityRes = await request(app.getHttpServer())
      .post(`/projects/${ownerB.projectId}/deploy/availability`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ deploymentName: 'shared-slot' });

    expect(availabilityRes.status).toBe(200);
    expect(availabilityRes.body.data.availability).toMatchObject({
      available: false,
      normalizedName: 'shared-slot',
      reason: 'Subdomain is already allocated',
    });

    const secondDeploy = await request(app.getHttpServer())
      .post(`/projects/${ownerB.projectId}/deploy`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ deploymentName: 'shared-slot', frontendTarget: 'react-web' });

    expect(secondDeploy.status).toBe(409);
  });
});

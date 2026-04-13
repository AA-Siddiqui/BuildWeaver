import {
  createDeploymentOverlayFiles,
  createPreviewComposeFile,
  isValidDeploymentName,
  normalizeDeploymentName,
  resolvePreviewDomains,
} from './deploy.utils';

describe('deploy.utils', () => {
  it('normalizes deployment names into lowercase hyphenated labels', () => {
    expect(normalizeDeploymentName('  My Cool_App  ')).toBe('my-cool-app');
    expect(normalizeDeploymentName('Alpha---Beta')).toBe('alpha-beta');
  });

  it('validates deployment names against DNS label constraints', () => {
    expect(isValidDeploymentName('preview-01')).toBe(true);
    expect(isValidDeploymentName('-bad')).toBe(false);
    expect(isValidDeploymentName('bad-')).toBe(false);
    expect(isValidDeploymentName('ab')).toBe(false);
  });

  it('derives frontend and backend preview domains', () => {
    const domains = resolvePreviewDomains('my-app', 'preview.buildweaver.dev');
    expect(domains.frontendDomain).toBe('my-app.preview.buildweaver.dev');
    expect(domains.backendDomain).toBe('api.my-app.preview.buildweaver.dev');
  });

  it('generates docker compose content with traefik labels and expected hosts', () => {
    const compose = createPreviewComposeFile({
      deploymentName: 'my-app',
      frontendDomain: 'my-app.preview.buildweaver.dev',
      backendDomain: 'api.my-app.preview.buildweaver.dev',
      traefikNetwork: 'traefik-public',
    });

    expect(compose).toContain('services:');
    expect(compose).toContain('traefik.http.routers.bw-preview-my-app-frontend.rule=Host(`my-app.preview.buildweaver.dev`)');
    expect(compose).toContain('traefik.http.routers.bw-preview-my-app-backend.rule=Host(`api.my-app.preview.buildweaver.dev`)');
    expect(compose).toContain('name: traefik-public');
    expect(compose).toContain('loadbalancer.server.port=80');
    expect(compose).toContain('loadbalancer.server.port=3000');
  });

  it('creates compose and Docker overlay files for deployment archive', () => {
    const overlay = createDeploymentOverlayFiles({
      deploymentName: 'sample',
      frontendDomain: 'sample.preview.buildweaver.dev',
      backendDomain: 'api.sample.preview.buildweaver.dev',
      traefikNetwork: 'traefik-public',
    });

    expect(overlay.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'docker-compose.preview.yml',
        'frontend/Dockerfile',
        'frontend/.dockerignore',
        'backend/Dockerfile',
        'backend/.dockerignore',
      ]),
    );
  });
});

import type { GeneratedFile } from '@buildweaver/codegen';

export interface PreviewDomains {
  frontendDomain: string;
  backendDomain: string;
}

export interface PreviewComposeConfig {
  deploymentName: string;
  frontendDomain: string;
  backendDomain: string;
  traefikNetwork: string;
}

const DEPLOYMENT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export const normalizeDeploymentName = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)+/g, '');

export const isValidDeploymentName = (input: string): boolean =>
  input.length >= 3 && input.length <= 63 && DEPLOYMENT_NAME_PATTERN.test(input);

export const resolvePreviewDomains = (
  deploymentName: string,
  previewBaseDomain: string,
): PreviewDomains => ({
  frontendDomain: `${deploymentName}.${previewBaseDomain}`,
  backendDomain: `api.${deploymentName}.${previewBaseDomain}`,
});

const createFrontendDockerfile = (): string => `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
`;

const createBackendDockerfile = (): string => `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start"]
`;

const createDockerIgnore = (): string => `node_modules
dist
.git
`;

export const createPreviewComposeFile = ({
  deploymentName,
  frontendDomain,
  backendDomain,
  traefikNetwork,
}: PreviewComposeConfig): string => {
  const frontendRouter = `bw-preview-${deploymentName}-frontend`;
  const backendRouter = `bw-preview-${deploymentName}-backend`;

  return `services:
  frontend:
    container_name: bw-preview-${deploymentName}-frontend
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    networks:
      - default
      - traefik-public
    labels:
      - traefik.enable=true
      - traefik.docker.network=${traefikNetwork}
      - traefik.http.routers.${frontendRouter}.rule=Host(\`${frontendDomain}\`)
      - traefik.http.routers.${frontendRouter}.entrypoints=websecure
      - traefik.http.routers.${frontendRouter}.tls=true
      - traefik.http.services.${frontendRouter}.loadbalancer.server.port=80

  backend:
    container_name: bw-preview-${deploymentName}-backend
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - default
      - traefik-public
    labels:
      - traefik.enable=true
      - traefik.docker.network=${traefikNetwork}
      - traefik.http.routers.${backendRouter}.rule=Host(\`${backendDomain}\`)
      - traefik.http.routers.${backendRouter}.entrypoints=websecure
      - traefik.http.routers.${backendRouter}.tls=true
      - traefik.http.services.${backendRouter}.loadbalancer.server.port=3000

networks:
  traefik-public:
    external: true
    name: ${traefikNetwork}
`;
};

export const createDeploymentOverlayFiles = (
  config: PreviewComposeConfig,
): GeneratedFile[] => [
  {
    path: 'docker-compose.preview.yml',
    contents: createPreviewComposeFile(config),
  },
  {
    path: 'frontend/Dockerfile',
    contents: createFrontendDockerfile(),
  },
  {
    path: 'frontend/.dockerignore',
    contents: createDockerIgnore(),
  },
  {
    path: 'backend/Dockerfile',
    contents: createBackendDockerfile(),
  },
  {
    path: 'backend/.dockerignore',
    contents: createDockerIgnore(),
  },
];

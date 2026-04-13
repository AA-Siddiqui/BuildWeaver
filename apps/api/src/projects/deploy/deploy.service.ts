import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { and, eq } from 'drizzle-orm';
import { Client, ConnectConfig, SFTPWrapper } from 'ssh2';
import {
  ReactAdapter,
  ExpressAdapter,
  bundleToZip,
  createBundle,
} from '@buildweaver/codegen';
import type { GeneratedFile } from '@buildweaver/codegen';
import {
  type Project,
  type ProjectDeployment,
  projectDeployments,
  projectGraphs,
  projectPages,
  projects,
} from '@buildweaver/db';
import type { ProjectGraphSnapshot } from '@buildweaver/libs';
import { DatabaseService } from '../../database/database.service';
import { buildProjectIrForDeployment } from './ir-builder';
import type { DeployProjectDto } from './dto/deploy-project.dto';
import {
  createDeploymentOverlayFiles,
  isValidDeploymentName,
  normalizeDeploymentName,
  resolvePreviewDomains,
} from './deploy.utils';

interface DeploymentServerConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  basePath: string;
  previewBaseDomain: string;
  traefikNetwork: string;
  dryRun: boolean;
}

export interface SubdomainAvailability {
  available: boolean;
  normalizedName: string;
  frontendDomain: string;
  backendDomain: string;
  reason?: string;
}

export interface DeployProjectResult {
  deploymentId: string;
  deploymentName: string;
  status: string;
  frontendDomain: string;
  backendDomain: string;
  frontendUrl: string;
  backendUrl: string;
  remotePath: string;
}

@Injectable()
export class ProjectDeployService {
  private readonly logger = new Logger(ProjectDeployService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async checkSubdomainAvailability(
    ownerId: string,
    projectId: string,
    deploymentName: string,
  ): Promise<SubdomainAvailability> {
    await this.assertProjectOwner(ownerId, projectId);
    return this.checkSubdomainAvailabilityForProject(projectId, deploymentName);
  }

  async deployProject(
    ownerId: string,
    projectId: string,
    dto: DeployProjectDto,
  ): Promise<DeployProjectResult> {
    const project = await this.assertProjectOwner(ownerId, projectId);
    const frontendTarget = dto.frontendTarget ?? 'react-web';
    if (frontendTarget !== 'react-web') {
      throw new BadRequestException(
        'Only react-web deployments are currently supported',
      );
    }

    const deployServerConfig = this.resolveDeploymentServerConfig();
    const normalizedName = this.normalizeAndValidateDeploymentName(
      dto.deploymentName,
    );

    this.logger.log(
      `Starting deployment for project=${projectId} deployment=${normalizedName}`,
    );

    const availability = await this.checkSubdomainAvailabilityForProject(
      projectId,
      normalizedName,
      deployServerConfig.previewBaseDomain,
    );

    if (!availability.available) {
      throw new ConflictException(
        availability.reason ?? 'Subdomain is not available',
      );
    }

    const remotePath = this.resolveRemotePath(
      deployServerConfig.basePath,
      normalizedName,
    );

    const pages = await this.db
      .select()
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId));

    const [graphRecord] = await this.db
      .select({ graph: projectGraphs.graph })
      .from(projectGraphs)
      .where(eq(projectGraphs.projectId, projectId))
      .limit(1);

    const graph =
      graphRecord?.graph ??
      ({
        nodes: [],
        edges: [],
        functions: [],
      } satisfies ProjectGraphSnapshot);

    this.logger.log(
      `Preparing project IR for deployment project=${projectId} pages=${pages.length} graphNodes=${graph.nodes.length} graphEdges=${graph.edges.length}`,
    );

    const projectIr = buildProjectIrForDeployment(project.name, pages, graph);

    this.logger.log(`Generating React and Express bundles project=${projectId}`);
    const reactBundle = await ReactAdapter.generate(projectIr);
    const expressBundle = await ExpressAdapter.generate(projectIr);

    const overlayFiles = createDeploymentOverlayFiles({
      deploymentName: normalizedName,
      frontendDomain: availability.frontendDomain,
      backendDomain: availability.backendDomain,
      traefikNetwork: deployServerConfig.traefikNetwork,
    });

    const combinedFiles: GeneratedFile[] = [
      ...reactBundle.files.map((file) => ({
        ...file,
        path: `frontend/${file.path}`,
      })),
      ...expressBundle.files.map((file) => ({
        ...file,
        path: `backend/${file.path}`,
      })),
      ...overlayFiles,
    ];

    const combinedBundle = createBundle('preview-fullstack', combinedFiles, {
      irVersion: projectIr.version,
      summary: `Preview deployment bundle for ${project.name}`,
      entryFile: 'docker-compose.preview.yml',
      metadata: {
        deploymentName: normalizedName,
        frontendDomain: availability.frontendDomain,
        backendDomain: availability.backendDomain,
      },
    });

    const archiveName = `${normalizedName}-preview.zip`;
    const zipArtifact = await bundleToZip(combinedBundle, archiveName);

    this.logger.log(
      `Deployment archive prepared deployment=${normalizedName} file=${zipArtifact.fileName} bytes=${zipArtifact.buffer.length}`,
    );

    const deployment = await this.reserveDeployment({
      ownerId,
      projectId,
      deploymentName: normalizedName,
      subdomain: normalizedName,
      frontendDomain: availability.frontendDomain,
      backendDomain: availability.backendDomain,
      remotePath,
    });

    try {
      if (deployServerConfig.dryRun) {
        this.logger.warn(
          `DEPLOY_DRY_RUN is enabled; skipping SSH deployment for deployment=${normalizedName}`,
        );
      } else {
        await this.uploadAndRunRemoteDeployment({
          config: deployServerConfig,
          deploymentName: normalizedName,
          remotePath,
          archiveName: zipArtifact.fileName,
          archiveBuffer: zipArtifact.buffer,
        });
      }

      const [updated] = await this.db
        .update(projectDeployments)
        .set({
          status: 'deployed',
          lastError: null,
          deployedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectDeployments.id, deployment.id))
        .returning();

      const resolved = updated ?? deployment;
      this.logger.log(
        `Deployment completed successfully deploymentId=${resolved.id} project=${projectId}`,
      );

      return this.toDeployResult(resolved);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown deployment error';
      this.logger.error(
        `Deployment failed for project=${projectId} deployment=${normalizedName} error=${message}`,
      );

      await this.db
        .update(projectDeployments)
        .set({
          status: 'failed',
          lastError: message.slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(eq(projectDeployments.id, deployment.id));

      throw new InternalServerErrorException(`Deployment failed: ${message}`);
    }
  }

  private async reserveDeployment(params: {
    ownerId: string;
    projectId: string;
    deploymentName: string;
    subdomain: string;
    frontendDomain: string;
    backendDomain: string;
    remotePath: string;
  }): Promise<ProjectDeployment> {
    const [existingBySubdomain] = await this.db
      .select()
      .from(projectDeployments)
      .where(eq(projectDeployments.subdomain, params.subdomain))
      .limit(1);

    if (
      existingBySubdomain &&
      existingBySubdomain.projectId !== params.projectId
    ) {
      throw new ConflictException('Subdomain is already allocated');
    }

    if (existingBySubdomain) {
      const [updated] = await this.db
        .update(projectDeployments)
        .set({
          ownerId: params.ownerId,
          deploymentName: params.deploymentName,
          frontendDomain: params.frontendDomain,
          backendDomain: params.backendDomain,
          remotePath: params.remotePath,
          status: 'deploying',
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(projectDeployments.id, existingBySubdomain.id))
        .returning();

      if (!updated) {
        throw new InternalServerErrorException(
          'Failed to reserve deployment record',
        );
      }

      return updated;
    }

    try {
      const [inserted] = await this.db
        .insert(projectDeployments)
        .values({
          ownerId: params.ownerId,
          projectId: params.projectId,
          deploymentName: params.deploymentName,
          subdomain: params.subdomain,
          frontendDomain: params.frontendDomain,
          backendDomain: params.backendDomain,
          remotePath: params.remotePath,
          status: 'deploying',
        })
        .returning();

      if (!inserted) {
        throw new InternalServerErrorException(
          'Failed to create deployment record',
        );
      }

      return inserted;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Subdomain is already allocated');
      }
      throw error;
    }
  }

  private async checkSubdomainAvailabilityForProject(
    projectId: string,
    deploymentName: string,
    baseDomainOverride?: string,
  ): Promise<SubdomainAvailability> {
    const normalizedName = this.normalizeAndValidateDeploymentName(
      deploymentName,
    );
    const previewBaseDomain =
      baseDomainOverride ?? this.resolvePreviewBaseDomain();
    const domains = resolvePreviewDomains(normalizedName, previewBaseDomain);

    const [existing] = await this.db
      .select({
        id: projectDeployments.id,
        projectId: projectDeployments.projectId,
      })
      .from(projectDeployments)
      .where(eq(projectDeployments.subdomain, normalizedName))
      .limit(1);

    if (existing && existing.projectId !== projectId) {
      return {
        available: false,
        normalizedName,
        frontendDomain: domains.frontendDomain,
        backendDomain: domains.backendDomain,
        reason: 'Subdomain is already allocated',
      };
    }

    return {
      available: true,
      normalizedName,
      frontendDomain: domains.frontendDomain,
      backendDomain: domains.backendDomain,
    };
  }

  private normalizeAndValidateDeploymentName(input: string): string {
    const normalizedName = normalizeDeploymentName(input);
    if (!isValidDeploymentName(normalizedName)) {
      throw new BadRequestException(
        'Deployment name must be 3-63 characters and may only contain lowercase letters, numbers, and hyphens',
      );
    }
    return normalizedName;
  }

  private resolveRemotePath(basePath: string, deploymentName: string): string {
    const normalizedBasePath = basePath.replace(/\/+$/, '');
    return `${normalizedBasePath}/${deploymentName}`;
  }

  private resolveDeploymentServerConfig(): DeploymentServerConfig {
    const host = this.configService.get<string>('DEPLOY_SSH_HOST')?.trim();
    const username = this.configService.get<string>('DEPLOY_SSH_USER')?.trim();
    const portValue = this.configService.get<string>('DEPLOY_SSH_PORT') ?? '22';
    const port = Number.parseInt(portValue, 10);

    if (!host || !username) {
      throw new InternalServerErrorException(
        'Deployment is not configured: DEPLOY_SSH_HOST and DEPLOY_SSH_USER are required',
      );
    }

    if (!Number.isFinite(port) || port <= 0) {
      throw new InternalServerErrorException(
        'Deployment is not configured: DEPLOY_SSH_PORT must be a valid positive number',
      );
    }

    const password = this.configService.get<string>('DEPLOY_SSH_PASSWORD');
    const privateKey = this.resolvePrivateKey();

    if (!password && !privateKey) {
      throw new InternalServerErrorException(
        'Deployment is not configured: provide DEPLOY_SSH_PASSWORD or DEPLOY_SSH_PRIVATE_KEY/DEPLOY_SSH_PRIVATE_KEY_PATH',
      );
    }

    return {
      host,
      port,
      username,
      password,
      privateKey,
      basePath:
        this.configService
          .get<string>('DEPLOY_BASE_PATH')
          ?.trim() || '/opt/buildweaver-preview',
      previewBaseDomain: this.resolvePreviewBaseDomain(),
      traefikNetwork:
        this.configService
          .get<string>('DEPLOY_TRAEFIK_NETWORK')
          ?.trim() || 'traefik-public',
      dryRun: this.parseBoolean(this.configService.get<string>('DEPLOY_DRY_RUN')),
    };
  }

  private resolvePrivateKey(): string | undefined {
    const privateKeyInline = this.configService
      .get<string>('DEPLOY_SSH_PRIVATE_KEY')
      ?.trim();
    if (privateKeyInline) {
      return privateKeyInline.replace(/\\n/g, '\n');
    }

    const privateKeyPath = this.configService
      .get<string>('DEPLOY_SSH_PRIVATE_KEY_PATH')
      ?.trim();
    if (!privateKeyPath) {
      return undefined;
    }

    try {
      return readFileSync(privateKeyPath, 'utf8');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown file read error';
      throw new InternalServerErrorException(
        `Failed to read DEPLOY_SSH_PRIVATE_KEY_PATH: ${message}`,
      );
    }
  }

  private resolvePreviewBaseDomain(): string {
    const configured =
      this.configService.get<string>('DEPLOY_PREVIEW_BASE_DOMAIN') ??
      'preview.buildweaver.dev';
    const normalized = configured
      .trim()
      .toLowerCase()
      .replace(/^\*\./, '')
      .replace(/^\./, '')
      .replace(/\.$/, '');

    if (!normalized) {
      throw new InternalServerErrorException(
        'DEPLOY_PREVIEW_BASE_DOMAIN must not be empty',
      );
    }

    return normalized;
  }

  private parseBoolean(value?: string): boolean {
    if (!value) {
      return false;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private buildSshConnectionConfig(
    config: DeploymentServerConfig,
  ): ConnectConfig {
    const connection: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 30_000,
    };

    if (config.password) {
      connection.password = config.password;
    }

    if (config.privateKey) {
      connection.privateKey = config.privateKey;
    }

    return connection;
  }

  private async uploadAndRunRemoteDeployment(params: {
    config: DeploymentServerConfig;
    deploymentName: string;
    remotePath: string;
    archiveName: string;
    archiveBuffer: Buffer;
  }): Promise<void> {
    const remoteArchivePath = `/tmp/buildweaver-preview-${params.deploymentName}-${Date.now()}-${randomUUID().slice(0, 8)}.zip`;

    this.logger.log(
      `Uploading deployment archive to remote host=${params.config.host} archivePath=${remoteArchivePath}`,
    );

    await this.uploadArchive(params.config, params.archiveBuffer, remoteArchivePath);

    this.logger.log(
      `Archive uploaded; executing remote docker compose deployment path=${params.remotePath}`,
    );

    const remoteCommand = this.buildRemoteDeployCommand(
      remoteArchivePath,
      params.remotePath,
      params.archiveName,
    );

    const execution = await this.executeRemoteCommand(
      params.config,
      remoteCommand,
    );

    this.logger.log(
      `Remote deployment command completed deployment=${params.deploymentName} stdoutBytes=${execution.stdout.length} stderrBytes=${execution.stderr.length}`,
    );

    if (execution.stderr.trim()) {
      this.logger.warn(
        `Remote deployment emitted stderr output deployment=${params.deploymentName} stderr=${execution.stderr.trim()}`,
      );
    }
  }

  private buildRemoteDeployCommand(
    remoteArchivePath: string,
    remotePath: string,
    archiveName: string,
  ): string {
    const escapedArchivePath = this.shellEscape(remoteArchivePath);
    const escapedRemotePath = this.shellEscape(remotePath);
    const escapedComposeFile = this.shellEscape('docker-compose.preview.yml');
    const escapedArchiveName = this.shellEscape(archiveName);

    const script = [
      'set -eu',
      'command -v unzip >/dev/null 2>&1',
      'command -v docker >/dev/null 2>&1',
      'docker compose version >/dev/null 2>&1',
      `rm -rf ${escapedRemotePath}`,
      `mkdir -p ${escapedRemotePath}`,
      `unzip -o ${escapedArchivePath} -d ${escapedRemotePath}`,
      `cd ${escapedRemotePath}`,
      `test -f ${escapedComposeFile}`,
      `docker compose -f ${escapedComposeFile} up -d --build --remove-orphans`,
      `rm -f ${escapedArchivePath}`,
      `echo "Deployment completed for archive ${escapedArchiveName}"`,
    ].join('; ');

    return `sh -lc ${this.shellEscape(script)}`;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }

  private async uploadArchive(
    config: DeploymentServerConfig,
    archiveBuffer: Buffer,
    remoteArchivePath: string,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const client = new Client();
      let settled = false;

      const settle = (handler: () => void): void => {
        if (!settled) {
          settled = true;
          handler();
        }
      };

      client
        .on('ready', () => {
          client.sftp((sftpError: Error | undefined, sftp: SFTPWrapper) => {
            if (sftpError) {
              client.end();
              settle(() => reject(sftpError));
              return;
            }

            const uploadStream = sftp.createWriteStream(remoteArchivePath, {
              mode: 0o644,
            });

            uploadStream.on('close', () => {
              client.end();
              settle(resolve);
            });

            uploadStream.on('error', (streamError: Error) => {
              client.end();
              settle(() => reject(streamError));
            });

            uploadStream.end(archiveBuffer);
          });
        })
        .on('error', (connectionError) => {
          settle(() => reject(connectionError));
        })
        .connect(this.buildSshConnectionConfig(config));
    });
  }

  private async executeRemoteCommand(
    config: DeploymentServerConfig,
    command: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      let stdout = '';
      let stderr = '';
      let settled = false;

      const settle = (handler: () => void): void => {
        if (!settled) {
          settled = true;
          handler();
        }
      };

      client
        .on('ready', () => {
          client.exec(command, (execError, stream) => {
            if (execError) {
              client.end();
              settle(() => reject(execError));
              return;
            }

            stream
              .on('close', (code: number | null) => {
                client.end();
                if (code === 0 || code === null) {
                  settle(() => resolve({ stdout, stderr }));
                  return;
                }

                const output = stderr.trim() || stdout.trim();
                settle(() =>
                  reject(
                    new Error(
                      `Remote command failed with exit code ${String(code)}${output ? `: ${output}` : ''}`,
                    ),
                  ),
                );
              })
              .on('data', (chunk: Buffer) => {
                stdout += chunk.toString();
              });

            stream.stderr.on('data', (chunk: Buffer) => {
              stderr += chunk.toString();
            });
          });
        })
        .on('error', (connectionError) => {
          settle(() => reject(connectionError));
        })
        .connect(this.buildSshConnectionConfig(config));
    });
  }

  private toDeployResult(deployment: ProjectDeployment): DeployProjectResult {
    return {
      deploymentId: deployment.id,
      deploymentName: deployment.deploymentName,
      status: deployment.status,
      frontendDomain: deployment.frontendDomain,
      backendDomain: deployment.backendDomain,
      frontendUrl: `https://${deployment.frontendDomain}`,
      backendUrl: `https://${deployment.backendDomain}`,
      remotePath: deployment.remotePath,
    };
  }

  private async assertProjectOwner(
    ownerId: string,
    projectId: string,
  ): Promise<Project> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .limit(1);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}

import { useState, useCallback } from 'react';
import {
  ReactAdapter,
  ExpressAdapter,
  createBundle,
  bundleToZipBlob,
} from '@buildweaver/codegen';
import type { GeneratedFile } from '@buildweaver/codegen';
import {
  projectPagesApi,
  projectGraphApi,
  projectDeployApi,
  type DeployProjectResult,
  type DeploySubdomainAvailability,
} from '../../lib/api-client';
import { codegenLogger } from '../../lib/logger';
import { buildProjectIR } from './ir-builder';

export type CodegenStatus =
  | 'idle'
  | 'fetching-pages'
  | 'fetching-graph'
  | 'generating'
  | 'zipping'
  | 'checking-subdomain'
  | 'deploying'
  | 'complete'
  | 'error';

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  codegenLogger.info('Download triggered', { fileName });
};

export const useCodegen = (projectId: string, projectName: string) => {
  const [status, setStatus] = useState<CodegenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [availability, setAvailability] = useState<DeploySubdomainAvailability | null>(null);
  const [deployment, setDeployment] = useState<DeployProjectResult | null>(null);

  const generate = useCallback(
    async (target: 'react-web' | 'flutter') => {
      if (target === 'flutter') {
        setError('Flutter code generation is not yet available.');
        setStatus('error');
        return;
      }

      try {
        setStatus('fetching-pages');
        setProgress('Fetching pages...');
        setError(null);
        setDeployment(null);
        codegenLogger.info('Starting code generation', { projectId, projectName, target });

        const { pages } = await projectPagesApi.list(projectId);
        codegenLogger.info('Pages fetched successfully', { count: pages.length });

        if (pages.length === 0) {
          codegenLogger.warn('No pages found in project');
        }

        // Fetch graph data for backend generation
        setStatus('fetching-graph');
        setProgress('Fetching logic graph...');
        let graph;
        try {
          const graphResult = await projectGraphApi.get(projectId);
          graph = graphResult.graph;
          codegenLogger.info('Graph fetched successfully', {
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            databases: graph.databases?.length ?? 0,
            queries: graph.queries?.length ?? 0,
          });
        } catch (graphErr) {
          codegenLogger.warn('Could not fetch graph (backend will have no queries/databases)', {
            error: graphErr instanceof Error ? graphErr.message : 'Unknown',
          });
          graph = undefined;
        }

        setStatus('generating');
        setProgress(`Generating frontend & backend for ${pages.length} page(s)...`);

        const projectIR = buildProjectIR(projectName, pages, graph);

        // Generate React frontend
        codegenLogger.info('Generating React frontend bundle');
        const reactBundle = await ReactAdapter.generate(projectIR);
        codegenLogger.info('React bundle generated', { fileCount: reactBundle.files.length });

        // Generate Express backend
        codegenLogger.info('Generating Express backend bundle');
        const expressBundle = await ExpressAdapter.generate(projectIR);
        codegenLogger.info('Express bundle generated', { fileCount: expressBundle.files.length });

        // Combine into single zip with frontend/ and backend/ folders
        setStatus('zipping');
        setProgress('Packaging zip archive...');

        const combinedFiles: GeneratedFile[] = [
          ...reactBundle.files.map((f) => ({ ...f, path: `frontend/${f.path}` })),
          ...expressBundle.files.map((f) => ({ ...f, path: `backend/${f.path}` })),
        ];

        const combinedBundle = createBundle('fullstack', combinedFiles, {
          irVersion: projectIR.version,
          summary: `Fullstack application for ${projectName}`,
          entryFile: 'backend/src/index.ts',
          metadata: {
            frontendFiles: reactBundle.files.length,
            backendFiles: expressBundle.files.length,
            pages: pages.length,
          },
        });

        codegenLogger.info('Combined bundle created', {
          totalFiles: combinedBundle.files.length,
          bundleId: combinedBundle.id,
        });

        const slugName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const { blob, fileName } = await bundleToZipBlob(
          combinedBundle,
          `${slugName}-fullstack.zip`,
        );
        codegenLogger.info('Zip archive created', { fileName });

        downloadBlob(blob, fileName);

        setStatus('complete');
        setProgress('Download started!');
        codegenLogger.info('Code generation complete', { fileName });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setError(message);
        setProgress('');
        codegenLogger.error('Code generation failed', { error: message });
      }
    },
    [projectId, projectName]
  );

  const checkAvailability = useCallback(
    async (deploymentName: string) => {
      const trimmedName = deploymentName.trim();
      if (!trimmedName) {
        setStatus('error');
        setError('Please provide a preferred subdomain.');
        return null;
      }

      try {
        setStatus('checking-subdomain');
        setProgress('Checking subdomain availability...');
        setError(null);

        const result = await projectDeployApi.checkAvailability(projectId, {
          deploymentName: trimmedName,
        });

        setAvailability(result.availability);
        setStatus('idle');
        setProgress('');

        codegenLogger.info('Subdomain availability checked', {
          projectId,
          requestedName: trimmedName,
          normalizedName: result.availability.normalizedName,
          available: result.availability.available,
        });

        return result.availability;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setError(message);
        setProgress('');
        codegenLogger.error('Subdomain availability check failed', {
          error: message,
          projectId,
        });
        return null;
      }
    },
    [projectId]
  );

  const deploy = useCallback(
    async (deploymentName: string, target: 'react-web' | 'flutter') => {
      if (target === 'flutter') {
        setError('Flutter deployment is not yet available.');
        setStatus('error');
        return;
      }

      const trimmedName = deploymentName.trim();
      if (!trimmedName) {
        setError('Please provide a preferred subdomain.');
        setStatus('error');
        return;
      }

      try {
        setStatus('checking-subdomain');
        setProgress('Checking subdomain availability...');
        setError(null);
        setDeployment(null);

        const availabilityResult = await projectDeployApi.checkAvailability(projectId, {
          deploymentName: trimmedName,
        });
        setAvailability(availabilityResult.availability);

        if (!availabilityResult.availability.available) {
          setStatus('error');
          setProgress('');
          setError(
            availabilityResult.availability.reason ??
              'That subdomain is not available. Please choose a different one.'
          );
          return;
        }

        setStatus('deploying');
        setProgress('Deploying application to preview environment...');

        const deployResult = await projectDeployApi.deploy(projectId, {
          deploymentName: availabilityResult.availability.normalizedName,
          frontendTarget: 'react-web',
        });

        setDeployment(deployResult.deployment);
        setStatus('complete');
        setProgress('Deployment completed successfully!');

        codegenLogger.info('Project deployed successfully', {
          projectId,
          deploymentId: deployResult.deployment.deploymentId,
          deploymentName: deployResult.deployment.deploymentName,
          frontendUrl: deployResult.deployment.frontendUrl,
          backendUrl: deployResult.deployment.backendUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setError(message);
        setProgress('');
        codegenLogger.error('Deployment failed', {
          error: message,
          projectId,
          deploymentName: trimmedName,
        });
      }
    },
    [projectId]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setProgress('');
    setAvailability(null);
    setDeployment(null);
  }, []);

  return {
    status,
    error,
    progress,
    availability,
    deployment,
    generate,
    checkAvailability,
    deploy,
    reset,
  };
};

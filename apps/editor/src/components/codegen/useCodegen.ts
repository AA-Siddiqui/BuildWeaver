import { useState, useCallback } from 'react';
import { ReactAdapter, bundleToZipBlob } from '@buildweaver/codegen';
import { projectPagesApi } from '../../lib/api-client';
import { codegenLogger } from '../../lib/logger';
import { buildProjectIR } from './ir-builder';

export type CodegenStatus = 'idle' | 'fetching-pages' | 'generating' | 'zipping' | 'complete' | 'error';

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
        codegenLogger.info('Starting code generation', { projectId, projectName, target });

        const { pages } = await projectPagesApi.list(projectId);
        codegenLogger.info('Pages fetched successfully', { count: pages.length });

        if (pages.length === 0) {
          codegenLogger.warn('No pages found in project');
        }

        setStatus('generating');
        setProgress(`Generating React code for ${pages.length} page(s)...`);

        const projectIR = buildProjectIR(projectName, pages);
        const bundle = await ReactAdapter.generate(projectIR);
        codegenLogger.info('Bundle generated', {
          fileCount: bundle.files.length,
          bundleId: bundle.id
        });

        setStatus('zipping');
        setProgress('Packaging zip archive...');

        const slugName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const { blob, fileName } = await bundleToZipBlob(bundle, `${slugName}-react.zip`);
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

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setProgress('');
  }, []);

  return { status, error, progress, generate, reset };
};

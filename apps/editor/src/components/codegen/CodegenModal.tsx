import { useState } from 'react';
import { useCodegen } from './useCodegen';
import type { CodegenStatus } from './useCodegen';

interface CodegenModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<CodegenStatus, string> = {
  idle: '',
  'fetching-pages': 'Fetching pages from project...',
  'fetching-graph': 'Fetching logic graph...',
  generating: 'Generating frontend & backend...',
  zipping: 'Packaging zip archive...',
  'checking-subdomain': 'Checking subdomain availability...',
  deploying: 'Deploying to preview environment...',
  complete: 'Export completed!',
  error: 'Export failed'
};

const toSuggestedDeploymentName = (projectName: string): string =>
  projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 63);

export const CodegenModal = ({ projectId, projectName, onClose }: CodegenModalProps) => {
  const {
    status,
    error,
    progress,
    availability,
    deployment,
    generate,
    checkAvailability,
    deploy,
    reset,
  } = useCodegen(projectId, projectName);
  const [deploymentName, setDeploymentName] = useState(() =>
    toSuggestedDeploymentName(projectName),
  );

  const normalizedCandidate = toSuggestedDeploymentName(deploymentName);
  const availabilityForCurrentName =
    availability?.normalizedName === normalizedCandidate ? availability : null;

  const isProcessing =
    status === 'fetching-pages' ||
    status === 'fetching-graph' ||
    status === 'generating' ||
    status === 'zipping' ||
    status === 'checking-subdomain' ||
    status === 'deploying';
  const isComplete = status === 'complete';
  const isError = status === 'error';

  const handleGenerate = (target: 'react-web' | 'flutter') => {
    generate(target);
  };

  const handleCheckAvailability = () => {
    checkAvailability(deploymentName);
  };

  const handleDeploy = () => {
    deploy(deploymentName, 'react-web');
  };

  const handleClose = () => {
    if (isProcessing) return;
    reset();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70"
        onClick={handleClose}
        role="presentation"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/10 bg-bw-ink shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Generate application code"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Code Generator</p>
              <p className="text-lg font-semibold text-white">{projectName}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-bw-platinum/70 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Close
            </button>
          </div>

          <div className="px-6 py-6">
            {status === 'idle' && (
              <>
                <p className="mb-4 text-sm text-bw-platinum/70">
                  Export your project as a zip file by selecting a frontend target.
                  The backend target is always ExpressJS.
                </p>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-bw-platinum/50">
                  Choose frontend target
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleGenerate('react-web')}
                    className="flex flex-col items-center gap-3 rounded-xl border border-bw-amber/30 bg-bw-amber/5 p-6 text-white transition hover:-translate-y-0.5 hover:border-bw-amber/60 hover:bg-bw-amber/10"
                  >
                    <span className="text-3xl">⚛</span>
                    <span className="text-sm font-semibold uppercase tracking-[0.15em]">Generate React</span>
                    <span className="text-xs text-bw-platinum/50">React + Express</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate('flutter')}
                    className="flex flex-col items-center gap-3 rounded-xl border border-bw-amber/30 bg-bw-amber/5 p-6 text-white transition hover:-translate-y-0.5 hover:border-bw-amber/60 hover:bg-bw-amber/10"
                  >
                    <span className="text-3xl">F</span>
                    <span className="text-sm font-semibold uppercase tracking-[0.15em]">Generate Flutter</span>
                    <span className="text-xs text-bw-platinum/50">Flutter + Express</span>
                  </button>
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">Deploy to Preview</p>
                  <p className="mt-1 text-xs text-bw-platinum/50">
                    Deploys to *.preview.buildweaver.dev via server-side SSH and docker compose.
                    Preview deployment currently supports React frontend.
                  </p>

                  <div className="mt-4">
                    <label
                      htmlFor="deployment-name"
                      className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-bw-platinum/60"
                    >
                      Preferred subdomain
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="deployment-name"
                        type="text"
                        value={deploymentName}
                        onChange={(event) => setDeploymentName(event.target.value)}
                        placeholder="my-preview-app"
                        className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-bw-amber/60"
                      />
                      <button
                        type="button"
                        onClick={handleCheckAvailability}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-bw-platinum/70 transition hover:bg-white/5"
                      >
                        Check
                      </button>
                    </div>
                  </div>

                  {availabilityForCurrentName && (
                    <div
                      className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                        availabilityForCurrentName.available
                          ? 'border-green-500/30 bg-green-500/10 text-green-300'
                          : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                      }`}
                    >
                      {availabilityForCurrentName.available
                        ? `Available. Frontend: ${availabilityForCurrentName.frontendDomain} | Backend: ${availabilityForCurrentName.backendDomain}`
                        : availabilityForCurrentName.reason ?? 'Subdomain is not available.'}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={!normalizedCandidate}
                    className="mt-4 w-full rounded-lg border border-bw-amber/30 bg-bw-amber/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-bw-amber/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Deploy to Preview
                  </button>
                </div>
              </>
            )}

            {isProcessing && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-bw-amber/30 border-t-bw-amber" />
                <p className="text-sm font-medium text-bw-platinum/80">
                  {progress || STATUS_LABELS[status]}
                </p>
              </div>
            )}

            {isComplete && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>

                {deployment ? (
                  <>
                    <p className="text-sm font-medium text-green-400">Deployment completed!</p>
                    <div className="w-full rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-200">
                      <p>Frontend URL: {deployment.frontendUrl}</p>
                      <p className="mt-1">Backend URL: {deployment.backendUrl}</p>
                      <p className="mt-1 text-green-300/90">Remote path: {deployment.remotePath}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-green-400">Download started!</p>
                    <p className="text-xs text-bw-platinum/50">
                      Your application has been generated and is downloading.
                    </p>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => { reset(); }}
                  className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-bw-platinum/70 transition hover:bg-white/5"
                >
                  Export again
                </button>
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-400">Generation failed</p>
                <p className="text-xs text-bw-platinum/50">{error}</p>
                <button
                  type="button"
                  onClick={() => { reset(); }}
                  className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-bw-platinum/70 transition hover:bg-white/5"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

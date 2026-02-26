const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export type FileEncoding = 'utf8' | 'base64';

export interface GeneratedFile {
  path: string;
  contents: string | Uint8Array;
  encoding?: FileEncoding;
}

export interface BundleManifest {
  adapter: string;
  createdAt: string;
  irVersion: string;
  summary: string;
  entryFile?: string;
  assets?: string[];
  metadata?: Record<string, unknown>;
}

export interface GeneratedBundle {
  id: string;
  files: GeneratedFile[];
  manifest: BundleManifest;
}

export interface BundleOptions {
  irVersion: string;
  summary: string;
  entryFile?: string;
  assets?: string[];
  metadata?: Record<string, unknown>;
}

const normalizePath = (filePath: string): string =>
  filePath.split(/[\\/]+/).join('/');

const sortFiles = (files: GeneratedFile[]): GeneratedFile[] =>
  [...files]
    .map((file) => ({
      ...file,
      path: normalizePath(file.path)
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

export const createBundle = (
  adapter: string,
  files: GeneratedFile[],
  options: BundleOptions
): GeneratedBundle => ({
  id: generateUUID(),
  files: sortFiles(files),
  manifest: {
    adapter,
    createdAt: new Date().toISOString(),
    ...options
  }
});

export const resolveEntryFile = (
  manifest: BundleManifest,
  fallback = 'README.md'
): string => manifest.entryFile ?? fallback;

export const describeManifest = (bundle: GeneratedBundle): string => {
  const entry = resolveEntryFile(bundle.manifest);
  return [
    `${bundle.manifest.summary}`,
    `Adapter: ${bundle.manifest.adapter}`,
    `Files: ${bundle.files.length}`,
    `Entry: ${entry}`
  ].join('\n');
};

export const fileList = (bundle: GeneratedBundle): string[] =>
  bundle.files.map((file) => normalizePath(file.path));

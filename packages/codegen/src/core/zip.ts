import JSZip from 'jszip';
import type { GeneratedBundle } from './bundle';

export interface ZipArtifact {
  fileName: string;
  buffer: Buffer;
}

export interface ZipBlobArtifact {
  fileName: string;
  blob: Blob;
}

const addFilesToZip = (zip: JSZip, bundle: GeneratedBundle): void => {
  bundle.files.forEach((file) => {
    zip.file(file.path, file.contents, {
      binary: typeof file.contents !== 'string'
    });
  });
};

const resolveZipFileName = (bundle: GeneratedBundle, archiveName?: string): string =>
  archiveName ?? `${bundle.manifest.adapter}-${bundle.id}.zip`;

export const bundleToZip = async (
  bundle: GeneratedBundle,
  archiveName?: string
): Promise<ZipArtifact> => {
  const zip = new JSZip();
  addFilesToZip(zip, bundle);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return {
    fileName: resolveZipFileName(bundle, archiveName),
    buffer
  };
};

export const bundleToZipBlob = async (
  bundle: GeneratedBundle,
  archiveName?: string
): Promise<ZipBlobArtifact> => {
  const zip = new JSZip();
  addFilesToZip(zip, bundle);

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return {
    fileName: resolveZipFileName(bundle, archiveName),
    blob
  };
};

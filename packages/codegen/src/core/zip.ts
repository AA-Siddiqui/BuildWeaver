import JSZip from 'jszip';
import type { Buffer } from 'node:buffer';
import type { GeneratedBundle } from './bundle';

export interface ZipArtifact {
  fileName: string;
  buffer: Buffer;
}

export const bundleToZip = async (
  bundle: GeneratedBundle,
  archiveName?: string
): Promise<ZipArtifact> => {
  const zip = new JSZip();

  bundle.files.forEach((file) => {
    const data = typeof file.contents === 'string' ? file.contents : file.contents;
    zip.file(file.path, data, {
      binary: typeof file.contents !== 'string'
    });
  });

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return {
    fileName:
      archiveName ?? `${bundle.manifest.adapter}-${bundle.id}.zip`,
    buffer
  };
};

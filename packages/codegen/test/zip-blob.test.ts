import JSZip from 'jszip';
import { createBundle, bundleToZip, bundleToZipBlob } from '../src';
import type { GeneratedBundle, GeneratedFile } from '../src';

const makeSampleBundle = (files?: GeneratedFile[]): GeneratedBundle =>
  createBundle(
    'test-adapter',
    files ?? [
      { path: 'README.md', contents: '# Test Project' },
      { path: 'src/index.ts', contents: 'export const hello = "world";' },
      { path: 'package.json', contents: '{ "name": "test" }' }
    ],
    {
      irVersion: '2025.02.0',
      summary: 'Test bundle for zip verification'
    }
  );

describe('bundleToZip', () => {
  it('returns a ZipArtifact with buffer', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZip(bundle);
    expect(artifact.buffer).toBeInstanceOf(Buffer);
    expect(artifact.buffer.length).toBeGreaterThan(0);
  });

  it('uses provided archive name', async () => {
    const artifact = await bundleToZip(makeSampleBundle(), 'custom-name.zip');
    expect(artifact.fileName).toBe('custom-name.zip');
  });

  it('generates default file name when no archive name provided', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZip(bundle);
    expect(artifact.fileName).toContain('test-adapter');
    expect(artifact.fileName).toContain(bundle.id);
    expect(artifact.fileName).toMatch(/\.zip$/);
  });

  it('all bundle files are present in the ZIP', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZip(bundle);
    const zip = await JSZip.loadAsync(artifact.buffer);
    const zipFiles = Object.keys(zip.files);

    expect(zipFiles).toContain('README.md');
    expect(zipFiles).toContain('src/index.ts');
    expect(zipFiles).toContain('package.json');
  });

  it('file contents in ZIP match original contents', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZip(bundle);
    const zip = await JSZip.loadAsync(artifact.buffer);

    for (const file of bundle.files) {
      const zipContent = await zip.file(file.path)?.async('string');
      expect(zipContent).toBe(file.contents);
    }
  });

  it('handles empty bundle', async () => {
    const bundle = makeSampleBundle([]);
    const artifact = await bundleToZip(bundle);
    expect(artifact.buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(artifact.buffer);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });

  it('handles binary file contents', async () => {
    const binaryContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const bundle = makeSampleBundle([
      { path: 'image.png', contents: binaryContent as unknown as string, encoding: 'base64' }
    ]);
    const artifact = await bundleToZip(bundle);
    expect(artifact.buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(artifact.buffer);
    expect(Object.keys(zip.files)).toContain('image.png');
  });

  it('handles deeply nested file paths', async () => {
    const bundle = makeSampleBundle([
      { path: 'src/components/ui/buttons/PrimaryButton.tsx', contents: 'export const PrimaryButton = () => {};' }
    ]);
    const artifact = await bundleToZip(bundle);
    const zip = await JSZip.loadAsync(artifact.buffer);
    expect(Object.keys(zip.files)).toContain('src/components/ui/buttons/PrimaryButton.tsx');
  });
});

describe('bundleToZipBlob', () => {
  it('returns a ZipBlobArtifact with blob', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZipBlob(bundle);
    expect(artifact.blob).toBeInstanceOf(Blob);
    expect(artifact.blob.size).toBeGreaterThan(0);
  });

  it('uses provided archive name', async () => {
    const artifact = await bundleToZipBlob(makeSampleBundle(), 'my-app.zip');
    expect(artifact.fileName).toBe('my-app.zip');
  });

  it('generates default file name when no archive name provided', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZipBlob(bundle);
    expect(artifact.fileName).toContain('test-adapter');
    expect(artifact.fileName).toContain(bundle.id);
    expect(artifact.fileName).toMatch(/\.zip$/);
  });

  it('blob contains all files from the bundle', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZipBlob(bundle);

    const arrayBuffer = await artifact.blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const zipFiles = Object.keys(zip.files);

    expect(zipFiles).toContain('README.md');
    expect(zipFiles).toContain('src/index.ts');
    expect(zipFiles).toContain('package.json');
  });

  it('blob content matches original file contents', async () => {
    const bundle = makeSampleBundle();
    const artifact = await bundleToZipBlob(bundle);

    const arrayBuffer = await artifact.blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    for (const file of bundle.files) {
      const zipContent = await zip.file(file.path)?.async('string');
      expect(zipContent).toBe(file.contents);
    }
  });

  it('handles empty bundle', async () => {
    const bundle = makeSampleBundle([]);
    const artifact = await bundleToZipBlob(bundle);
    expect(artifact.blob.size).toBeGreaterThan(0);
  });
});

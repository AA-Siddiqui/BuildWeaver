import type { ProjectIR } from '@buildweaver/libs';
import { normalizeProject } from './core/normalize';

export * from './core/adapter';
export * from './core/bundle';
export * from './core/zip';
export { normalizeProject } from './core/normalize';
export * from './adapters';

export const serializeIr = (ir: ProjectIR): string =>
	JSON.stringify(normalizeProject(ir), null, 2);

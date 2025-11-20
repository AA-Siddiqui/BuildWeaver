import type { ProjectIR } from '@buildweaver/libs';

export const serializeIr = (ir: ProjectIR): string => JSON.stringify(ir, null, 2);

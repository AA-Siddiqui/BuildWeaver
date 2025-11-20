import type { ProjectIR, TargetFramework } from '@buildweaver/libs';
import type { GeneratedBundle } from './bundle';
import { normalizeProject } from './normalize';

export interface CodegenAdapter {
  name: string;
  target: TargetFramework;
  generate(ir: ProjectIR): Promise<GeneratedBundle>;
}

export const createAdapterRunner = (adapter: CodegenAdapter) => async (
  ir: ProjectIR
): Promise<GeneratedBundle> => adapter.generate(normalizeProject(ir));

export class AdapterRegistry {
  private readonly adapters = new Map<string, CodegenAdapter>();

  register(adapter: CodegenAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): CodegenAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter ${name} is not registered.`);
    }
    return adapter;
  }

  list(): CodegenAdapter[] {
    return [...this.adapters.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }
}

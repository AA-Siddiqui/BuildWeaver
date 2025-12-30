import type { ComponentBindingReference } from '@buildweaver/libs';
import { Logger } from '@nestjs/common';
import type { DatabaseService } from '../../database/database.service';
import { ProjectComponentsService } from './components.service';

const createService = () => {
  const databaseStub = { db: {} } as unknown as DatabaseService;
  const service = new ProjectComponentsService(databaseStub);
  const scopedLogger = new Logger(ProjectComponentsService.name);
  Reflect.set(service as unknown as Record<string, unknown>, 'logger', scopedLogger);
  jest.spyOn(scopedLogger, 'log').mockImplementation(() => {});
  jest.spyOn(scopedLogger, 'warn').mockImplementation(() => {});
  return service;
};

const normalizeBindings = (
  service: ProjectComponentsService,
  refs: Partial<ComponentBindingReference>[]
): ComponentBindingReference[] =>
  (service as unknown as { normalizeBindingReferences: (r: Partial<ComponentBindingReference>[], meta: { name: string; projectId: string }) => ComponentBindingReference[] }).normalizeBindingReferences(refs as ComponentBindingReference[], {
    name: 'Hero',
    projectId: 'project-123'
  });

describe('ProjectComponentsService normalization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('strips duplicate binding references by id and property path', () => {
    const service = createService();
    const refs = normalizeBindings(service, [
      { bindingId: 'title', propertyPath: ['text'] },
      { bindingId: 'title', propertyPath: ['text'] },
      { bindingId: 'title', propertyPath: ['meta'] }
    ]);
    expect(refs).toHaveLength(2);
    expect(refs.find((ref) => ref.propertyPath?.includes('meta'))).toBeDefined();
  });

  it('discards entries without binding ids', () => {
    const service = createService();
    const refs = normalizeBindings(service, [
      { bindingId: 'title' },
      { propertyPath: ['text'] }
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.bindingId).toBe('title');
  });

  it('sanitizes property paths to defined string segments', () => {
    const service = createService();
    const refs = normalizeBindings(service, [
      { bindingId: 'author', propertyPath: [' ', 'name', ''] }
    ]);
    expect(refs[0]?.propertyPath).toEqual(['name']);
  });

  it('marks exposeAsParameter only when truthy', () => {
    const service = createService();
    const refs = normalizeBindings(service, [
      { bindingId: 'author', exposeAsParameter: true },
      { bindingId: 'title', exposeAsParameter: 'true' as unknown as boolean }
    ]);
    expect(refs[0]?.exposeAsParameter).toBe(true);
    expect(refs[1]?.exposeAsParameter).toBe(false);
  });

  it('defaults invalid definitions to empty object', () => {
    const service = createService();
    const definition = (service as unknown as { normalizeDefinition: (d: unknown, meta: { name: string; projectId: string }) => unknown }).normalizeDefinition('not-an-object', {
      name: 'Card',
      projectId: 'project-123'
    });
    expect(definition).toEqual({});
  });
});

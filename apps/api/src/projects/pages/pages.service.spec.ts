import type { PageDynamicInput } from '@buildweaver/libs';
import { Logger } from '@nestjs/common';
import { ProjectPagesService } from './pages.service';
import type { DatabaseService } from '../../database/database.service';

const createService = () => {
  const databaseStub = { db: {} } as unknown as DatabaseService;
  const service = new ProjectPagesService(databaseStub);
  const scopedLogger = new Logger(ProjectPagesService.name);
  // Silence noisy logger output during tests.
  Reflect.set(service as unknown as Record<string, unknown>, 'logger', scopedLogger);
  jest.spyOn(scopedLogger, 'log').mockImplementation(() => {});
  jest.spyOn(scopedLogger, 'warn').mockImplementation(() => {});
  return service;
};

const invokeNormalizeInputs = (service: ProjectPagesService, inputs: Partial<PageDynamicInput>[]) =>
  (service as unknown as { normalizeInputs: (payload: Partial<PageDynamicInput>[]) => PageDynamicInput[] }).normalizeInputs(
    inputs as PageDynamicInput[]
  );

describe('ProjectPagesService dynamic inputs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults list item types to string when omitted', () => {
    const service = createService();
    const [input] = invokeNormalizeInputs(service, [{ id: 'list-1', label: 'Articles', dataType: 'list' }]);
    expect(input.listItemType).toBe('string');
  });

  it('preserves sanitized samples for list objects', () => {
    const service = createService();
    const [input] = invokeNormalizeInputs(service, [
      {
        id: 'list-2',
        label: 'Articles',
        dataType: 'list',
        listItemType: 'object',
        objectSample: {
          title: 'Hello world',
          meta: {
            views: 10
          }
        }
      }
    ]);
    expect(input.objectSample).toEqual({ title: 'Hello world', meta: { views: 10 } });
  });

  it('warns and falls back when list item type is invalid', () => {
    const service = createService();
    const warnSpy = jest.spyOn(service['logger'], 'warn');
    const [input] = invokeNormalizeInputs(service, [
      {
        id: 'list-3',
        label: 'Articles',
        dataType: 'list',
        // @ts-expect-error - intentional invalid type for test coverage
        listItemType: 'invalid'
      }
    ]);
    expect(input.listItemType).toBe('string');
    expect(warnSpy).toHaveBeenCalledWith(
      'List item type defaulted',
      expect.objectContaining({ inputId: 'list-3', label: 'Articles' })
    );
  });
});

import { act, renderHook } from '@testing-library/react';
import { useNodePaletteVisibility } from './useNodePaletteVisibility';

describe('useNodePaletteVisibility', () => {
  const createLogger = () => ({
    info: jest.fn(),
    debug: jest.fn()
  });

  it('toggles visibility and logs transitions', () => {
    const logger = createLogger();
    const { result } = renderHook(() =>
      useNodePaletteVisibility({ projectId: 'proj-123', logger })
    );

    act(() => {
      result.current.toggle('header-control');
    });

    expect(result.current.isVisible).toBe(false);
    expect(logger.info).toHaveBeenCalledWith('Node palette visibility changed', {
      projectId: 'proj-123',
      visible: false,
      source: 'header-control'
    });

    act(() => {
      result.current.toggle('header-control');
    });

    expect(result.current.isVisible).toBe(true);
    expect(logger.info).toHaveBeenLastCalledWith('Node palette visibility changed', {
      projectId: 'proj-123',
      visible: true,
      source: 'header-control'
    });
  });

  it('avoids duplicate hide/show transitions', () => {
    const logger = createLogger();
    const { result } = renderHook(() =>
      useNodePaletteVisibility({ projectId: 'proj-xyz', logger })
    );

    act(() => {
      result.current.hide('user-action');
    });
    expect(result.current.isVisible).toBe(false);
    expect(logger.info).toHaveBeenCalledWith('Node palette visibility changed', {
      projectId: 'proj-xyz',
      visible: false,
      source: 'user-action'
    });

    act(() => {
      result.current.hide('user-action');
    });
    expect(logger.debug).toHaveBeenCalledWith('Node palette already hidden', {
      projectId: 'proj-xyz',
      source: 'user-action'
    });

    act(() => {
      result.current.show('user-action');
    });
    expect(result.current.isVisible).toBe(true);
    expect(logger.info).toHaveBeenLastCalledWith('Node palette visibility changed', {
      projectId: 'proj-xyz',
      visible: true,
      source: 'user-action'
    });

    act(() => {
      result.current.show('user-action');
    });
    expect(logger.debug).toHaveBeenCalledWith('Node palette already visible', {
      projectId: 'proj-xyz',
      source: 'user-action'
    });
  });
});
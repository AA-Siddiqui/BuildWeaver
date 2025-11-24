import { render } from '@testing-library/react';
import { attachNodeIdentity, NODE_DATA_ATTRIBUTE, renderScopedCss } from './custom-css';

describe('custom-css helpers', () => {
  it('attaches node identity without overriding existing id', () => {
    const attributes = attachNodeIdentity('node-1', { 'aria-label': 'demo', id: 'user-provided' });
    expect(attributes).toMatchObject({ 'aria-label': 'demo', id: 'user-provided', [NODE_DATA_ATTRIBUTE]: 'node-1' });
  });

  it('injects id when missing', () => {
    const attributes = attachNodeIdentity('node-2', { 'data-testid': 'heading' });
    expect(attributes.id).toBe('node-2');
    expect(attributes[NODE_DATA_ATTRIBUTE]).toBe('node-2');
  });

  it('renders a scoped style tag when css is provided', () => {
    const { container } = render(renderScopedCss('node-3', 'color: red; background: blue;'));
    const style = container.querySelector('style');
    expect(style?.innerHTML).toContain('[data-bw-node="node-3"]');
    expect(style?.innerHTML).toContain('color: red;');
  });

  it('returns null when node id or css is missing', () => {
    expect(renderScopedCss(undefined, 'color: red;')).toBeNull();
    expect(renderScopedCss('node-4', '')).toBeNull();
  });
});

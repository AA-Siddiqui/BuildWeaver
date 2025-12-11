import { render, screen } from '@testing-library/react';
import { LIST_SCOPE_BINDING_PREFIX, ListSlotContextProvider, resolveListSlotScopedValue } from './list-slot-context';

const renderWithListScope = (value: Parameters<typeof ListSlotContextProvider>[0]['value'], bindingId: string) => {
  const Probe = () => {
    const resolved = resolveListSlotScopedValue(bindingId);
    return <div data-testid="resolved-value">{resolved === undefined ? 'undefined' : String(resolved)}</div>;
  };
  render(
    <ListSlotContextProvider value={value}>
      <Probe />
    </ListSlotContextProvider>
  );
};

describe('resolveListSlotScopedValue (React context bridge)', () => {
  it('reads scalar list item values when invoked during render', () => {
    const bindingId = `${LIST_SCOPE_BINDING_PREFIX}list-alpha`;
    renderWithListScope(
      {
        listComponentId: 'list-alpha',
        sourceBindingId: 'dynamic-feed',
        currentIndex: 2,
        itemValue: 42
      },
      bindingId
    );
    expect(screen.getByTestId('resolved-value')).toHaveTextContent('42');
  });

  it('projects property paths relative to the active list item', () => {
    const bindingId = `${LIST_SCOPE_BINDING_PREFIX}list-beta`;
    const value = {
      listComponentId: 'list-beta',
      sourceBindingId: 'dynamic-feed',
      currentIndex: 0,
      itemValue: { title: 'Changelog', stats: { count: 7 } }
    } as const;
    const Probe = () => {
      const title = resolveListSlotScopedValue(bindingId, ['title']);
      const count = resolveListSlotScopedValue(bindingId, ['stats', 'count']);
      const normalizedTitle = title === undefined ? '' : String(title);
      return (
        <>
          <div data-testid="title">{normalizedTitle}</div>
          <div data-testid="count">{String(count)}</div>
        </>
      );
    };
    render(
      <ListSlotContextProvider value={value}>
        <Probe />
      </ListSlotContextProvider>
    );
    expect(screen.getByTestId('title')).toHaveTextContent('Changelog');
    expect(screen.getByTestId('count')).toHaveTextContent('7');
  });
});

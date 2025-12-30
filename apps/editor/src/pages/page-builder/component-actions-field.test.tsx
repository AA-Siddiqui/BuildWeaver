import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentData, CustomField, Data, FieldProps } from '@measured/puck';
import type { BindingOption } from './dynamic-binding';
import { ComponentActionsField } from './component-actions-field';
import { ComponentLibraryProvider, type ComponentLibraryContextValue } from './component-library-context';
import { usePuck } from '@measured/puck';
import { createDynamicBindingState } from './dynamic-binding';

jest.mock('@measured/puck', () => ({
  usePuck: jest.fn()
}));

const mockUsePuck = usePuck as unknown as jest.Mock;

const bindingOptions: BindingOption[] = [{ label: 'Title', value: 'title' }];

const builderState: Data = {
  root: { props: {} },
  content: [
    {
      type: 'Heading',
      props: {
        id: 'hero-1',
        content: createDynamicBindingState('title', '')
      }
    } as ComponentData
  ]
};

const renderField = (overrides?: Partial<ComponentLibraryContextValue>) => {
  const saveComponent = jest.fn().mockResolvedValue(undefined);
  const value: ComponentLibraryContextValue = {
    builderState,
    bindingOptions,
    componentLibrary: [],
    isSavingComponent: false,
    saveComponent,
    ...overrides
  } as ComponentLibraryContextValue;

  mockUsePuck.mockReturnValue({ selectedItem: { props: { id: 'hero-1' } } });

  const stubField: CustomField<null> = { type: 'custom', label: 'Component actions', render: () => <></> };

  const fieldProps = {
    field: stubField,
    value: null,
    onChange: jest.fn(),
    readOnly: false
  } as unknown as FieldProps<CustomField<null>, null>;

  render(
    <ComponentLibraryProvider value={value}>
      <ComponentActionsField {...fieldProps} />
    </ComponentLibraryProvider>
  );

  return { saveComponent };
};

describe('ComponentActionsField', () => {
  it('allows marking a dynamic binding as a parameter before saving', async () => {
    const { saveComponent } = renderField();

    fireEvent.change(screen.getByLabelText(/component name/i), { target: { value: 'Card' } });

    const parameterToggle = screen.getByLabelText(/expose as component parameter/i);
    fireEvent.click(parameterToggle);

    fireEvent.click(screen.getByRole('button', { name: /make component/i }));

    await waitFor(() => {
      expect(saveComponent).toHaveBeenCalled();
    });

    const [{ bindingReferences }] = saveComponent.mock.calls[0];
    expect(bindingReferences[0]?.exposeAsParameter).toBe(true);
  });
});

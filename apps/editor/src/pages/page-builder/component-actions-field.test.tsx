import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentData, CustomField, Data, FieldProps } from '@measured/puck';
import type { BindingOption } from './dynamic-binding';
import { ComponentActionsField } from './component-actions-field';
import { ComponentLibraryProvider, type ComponentLibraryContextValue } from './component-library-context';
import { usePuck } from '@measured/puck';
import { createDynamicBindingState } from './dynamic-binding';

jest.mock('./feature-flags', () => {
  let slotFlag = false;
  return {
    __esModule: true,
    get ENABLE_SLOT_PARAMETERS() {
      return slotFlag;
    },
    logFeatureFlagEvent: jest.fn(),
    __setSlotFlag(value: boolean) {
      slotFlag = value;
    }
  };
});

const { __setSlotFlag } = jest.requireMock('./feature-flags') as { __setSlotFlag: (value: boolean) => void };

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

const slotBuilderState: Data = {
  root: { props: {} },
  content: [
    {
      type: 'Section',
      props: {
        id: 'section-1',
        contentSlot: [
          {
            type: 'Heading',
            props: {
              id: 'slot-heading',
              content: createDynamicBindingState('title', '')
            }
          } as ComponentData
        ]
      }
    } as ComponentData
  ]
};

const renderField = (
  overrides?: Partial<ComponentLibraryContextValue>,
  options?: { state?: Data; selectedId?: string }
) => {
  const saveComponent = jest.fn().mockResolvedValue(undefined);
  const value: ComponentLibraryContextValue = {
    builderState: options?.state ?? builderState,
    bindingOptions,
    componentLibrary: [],
    isSavingComponent: false,
    saveComponent,
    ...overrides
  } as ComponentLibraryContextValue;

  mockUsePuck.mockReturnValue({ selectedItem: { props: { id: options?.selectedId ?? 'hero-1' } } });

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
  beforeEach(() => {
    __setSlotFlag(false);
    jest.clearAllMocks();
  });

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

  it("disables slot parameter selection when the feature flag is off", async () => {
    const { saveComponent } = renderField({}, { state: slotBuilderState, selectedId: "section-1" });

    fireEvent.change(screen.getByLabelText(/component name/i), {
      target: { value: "Section" },
    });

    expect(screen.queryByLabelText(/component parameter/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /make component/i }));

    await waitFor(() => {
      expect(saveComponent).toHaveBeenCalled();
    });

    const [{ bindingReferences }] = saveComponent.mock.calls[0];
    expect(bindingReferences[0]?.exposeAsParameter ?? false).toBe(false);
  });


  it('allows slot parameter selection when the feature flag is on', async () => {
    __setSlotFlag(true);
    const { saveComponent } = renderField({}, { state: slotBuilderState, selectedId: 'section-1' });

    fireEvent.change(screen.getByLabelText(/component name/i), { target: { value: 'Section' } });

    const parameterToggle = screen.getByLabelText(/component parameter/i);
    expect(parameterToggle).not.toBeDisabled();
    fireEvent.click(parameterToggle);

    fireEvent.click(screen.getByRole('button', { name: /make component/i }));

    await waitFor(() => {
      expect(saveComponent).toHaveBeenCalled();
    });

    const [{ bindingReferences }] = saveComponent.mock.calls[0];
    expect(bindingReferences[0]?.exposeAsParameter).toBe(true);
  });
});

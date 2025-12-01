import { fireEvent, render, screen } from '@testing-library/react';
import { createDynamicBindingState } from './dynamic-binding';
import {
  DYNAMIC_SELECT_OPTIONS_METADATA_KEY,
  createDynamicBooleanField,
  createDynamicSelectField,
  createDynamicTextField
} from './dynamic-field-control';

describe('DynamicFieldControl', () => {
  const bindingOptions = [
    { label: 'Hero title', value: 'heroTitle' },
    { label: 'CTA label', value: 'ctaLabel' }
  ];

  const renderTextField = (value: unknown, onChange = jest.fn()) => {
    const field = createDynamicTextField({
      fieldKey: 'heading',
      bindingOptions,
      label: 'Heading',
      placeholder: 'Hero heading'
    });

    if (field.type !== 'custom' || typeof field.render !== 'function') {
      throw new Error('Dynamic text field must be a custom field');
    }

    const props = {
      field,
      id: 'heading-field',
      name: 'heading',
      onChange,
      readOnly: false,
      value
    } as Parameters<NonNullable<typeof field.render>>[0];

    return { onChange, ...render(<>{field.render(props)}</>) };
  };

  it('switches into dynamic mode via the toggle button', () => {
    const handleChange = jest.fn();
    renderTextField('Welcome', handleChange);
    fireEvent.click(screen.getByRole('button', { name: /toggle dynamic binding/i }));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        __bwDynamicBinding: true,
        bindingId: 'heroTitle',
        fallback: 'Welcome'
      })
    );
  });

  it('updates the selected binding when a new option is chosen', () => {
    const handleChange = jest.fn();
    renderTextField(createDynamicBindingState('heroTitle', 'Hello'), handleChange);
    fireEvent.change(screen.getByLabelText(/dynamic source/i), { target: { value: 'ctaLabel' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        __bwDynamicBinding: true,
        bindingId: 'ctaLabel',
        fallback: 'Hello'
      })
    );
  });

  it('persists fallback edits while staying in dynamic mode', () => {
    const handleChange = jest.fn();
    renderTextField(createDynamicBindingState('heroTitle', 'Original heading'), handleChange);
    fireEvent.change(screen.getByPlaceholderText('Hero heading'), { target: { value: 'Updated heading' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        __bwDynamicBinding: true,
        bindingId: 'heroTitle',
        fallback: 'Updated heading'
      })
    );
  });
});

describe('createDynamicSelectField', () => {
  it('prefers metadata-provided options', () => {
    const field = createDynamicSelectField({
      fieldKey: 'caseKey',
      bindingOptions: [],
      label: 'Case key',
      options: [
        { label: 'Default case', value: 'default' }
      ]
    });

    if (field.type !== 'custom' || typeof field.render !== 'function') {
      throw new Error('Select field must be a custom field');
    }

    const metadataField = {
      ...field,
      metadata: {
        [DYNAMIC_SELECT_OPTIONS_METADATA_KEY]: [
          { label: 'Meta primary', value: 'meta-primary' },
          { label: 'Meta secondary', value: 'meta-secondary' }
        ]
      }
    } as typeof field;

    render(
      <>
        {field.render({
          field: metadataField,
          id: 'case-key-field',
          name: 'caseKey',
          onChange: jest.fn(),
          readOnly: false,
          value: 'meta-secondary'
        } as Parameters<NonNullable<typeof field.render>>[0])}
      </>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('meta-secondary');
  });
});

describe('createDynamicBooleanField', () => {
  const bindingOptions = [{ label: 'Toggle', value: 'toggle' }];

  const renderBooleanField = (value: unknown, onChange = jest.fn()) => {
    const field = createDynamicBooleanField({
      fieldKey: 'renderWhen',
      bindingOptions,
      label: 'Visibility',
      trueLabel: 'Render',
      falseLabel: 'Hide',
      defaultValue: true
    });

    if (field.type !== 'custom' || typeof field.render !== 'function') {
      throw new Error('Boolean field must render as a custom field');
    }

    const props = {
      field,
      id: 'render-field',
      name: 'renderWhen',
      onChange,
      readOnly: false,
      value
    } as Parameters<NonNullable<typeof field.render>>[0];

    return { onChange, ...render(<>{field.render(props)}</>) };
  };

  it('defaults to true when no value is provided', () => {
    renderBooleanField(undefined);
    const select = screen.getByLabelText('Visibility') as HTMLSelectElement;
    expect(select.value).toBe('true');
  });

  it('propagates user selections as boolean strings', () => {
    const handleChange = jest.fn();
    renderBooleanField('true', handleChange);
    const select = screen.getByLabelText('Visibility');
    fireEvent.change(select, { target: { value: 'false' } });
    expect(handleChange).toHaveBeenCalledWith('false');
  });
});

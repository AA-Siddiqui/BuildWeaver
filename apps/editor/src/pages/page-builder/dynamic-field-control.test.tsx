import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { createDynamicBindingState, type BindingOption } from './dynamic-binding';
import {
  DYNAMIC_SELECT_OPTIONS_METADATA_KEY,
  createDynamicBooleanField,
  createDynamicSelectField,
  createDynamicTextField
} from './dynamic-field-control';

describe('DynamicFieldControl', () => {
  const bindingOptions: BindingOption[] = [
    { label: 'Hero title', value: 'heroTitle' },
    { label: 'CTA label', value: 'ctaLabel' },
    {
      label: 'CTA payload',
      value: 'ctaPayload',
      dataType: 'object',
      objectSample: {
        label: 'Join now',
        link: {
          href: 'https://example.com',
          target: '_blank'
        }
      }
    }
  ];
  const listBindingOptions: BindingOption[] = [
    {
      label: 'Articles',
      value: 'articles',
      dataType: 'list',
      listItemType: 'object',
      listObjectSample: {
        title: 'Sample article',
        author: {
          name: 'Avery'
        }
      }
    }
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

    const Harness = () => {
      const [currentValue, setCurrentValue] = useState(value);
      return (
        <>
          {field.render({
            ...props,
            value: currentValue,
            onChange: (next) => {
              setCurrentValue(next);
              onChange(next);
            }
          })}
        </>
      );
    };

    return { onChange, ...render(<Harness />) };
  };

  const renderListField = (value: unknown, onChange = jest.fn()) => {
    const field = createDynamicTextField({
      fieldKey: 'listField',
      bindingOptions: listBindingOptions,
      label: 'Articles',
      placeholder: 'Articles',
      helperText: 'Bind to a list input',
      allowedDataTypes: ['list']
    });

    if (field.type !== 'custom' || typeof field.render !== 'function') {
      throw new Error('List field must render as a custom field');
    }

    const props = {
      field,
      id: 'list-field',
      name: 'list',
      onChange,
      readOnly: false,
      value
    } as Parameters<NonNullable<typeof field.render>>[0];

    const Harness = () => {
      const [currentValue, setCurrentValue] = useState(value);
      return (
        <>
          {field.render({
            ...props,
            value: currentValue,
            onChange: (next) => {
              setCurrentValue(next);
              onChange(next);
            }
          })}
        </>
      );
    };

    return { onChange, ...render(<Harness />) };
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

  it('surfaces nested selectors for object bindings', () => {
    const handleChange = jest.fn();
    renderTextField(createDynamicBindingState('ctaPayload', 'Join us', ['link']), handleChange);
    fireEvent.change(screen.getByRole('combobox', { name: /dynamic source/i }), {
      target: { value: 'ctaPayload' }
    });
    const topLevelSelect = screen.getByLabelText('Select object property') as HTMLSelectElement;
    expect(topLevelSelect.value).toBe('link');
    const nestedSelect = screen.getByLabelText('Select nested property level 2');
    fireEvent.change(nestedSelect, { target: { value: 'href' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bindingId: 'ctaPayload',
        propertyPath: ['link', 'href']
      })
    );
  });

  it('shows warnings when binding type does not match allowed data types', () => {
    renderListField(createDynamicBindingState('heroTitle', 'Default'));
    expect(screen.getByText(/expects list data/i)).toBeInTheDocument();
  });

  it('allows selecting list entries and object properties', () => {
    const handleChange = jest.fn();
    renderListField(createDynamicBindingState('articles', '[]'), handleChange);
    handleChange.mockClear();
    fireEvent.click(screen.getByLabelText('Display a specific item'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bindingId: 'articles',
        propertyPath: ['0']
      })
    );
    handleChange.mockClear();
    const indexInput = screen.getByLabelText(/item index/i) as HTMLInputElement;
    fireEvent.change(indexInput, { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyPath: ['2', 'title']
      })
    );
    handleChange.mockClear();
    const propertySelect = screen.getByLabelText('Select object property') as HTMLSelectElement;
    fireEvent.change(propertySelect, { target: { value: 'author' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyPath: ['2', 'author']
      })
    );
    handleChange.mockClear();
    const nestedSelect = screen.getByLabelText('Select nested property level 2') as HTMLSelectElement;
    fireEvent.change(nestedSelect, { target: { value: 'name' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyPath: ['2', 'author', 'name']
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

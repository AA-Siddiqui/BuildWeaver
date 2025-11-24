import { fireEvent, render, screen } from '@testing-library/react';
import { createDynamicBindingState } from './dynamic-binding';
import { createDynamicTextField } from './dynamic-field-control';

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

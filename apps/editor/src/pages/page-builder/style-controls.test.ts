import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildAttributeProps,
  createInlineStyle,
  deriveColorPickerValue,
  splitStyleProps,
  withStyleFields
} from './style-controls';

describe('style-controls helpers', () => {
  it('appends shared style fields without mutating source', () => {
    const original = { foo: { type: 'text', label: 'Foo' } } as const;
    const extended = withStyleFields(original);
    expect(extended.foo).toEqual(original.foo);
    expect(Object.keys(extended)).toEqual(expect.arrayContaining(['foo', 'layoutDisplay', 'padding']));
  });

  it('splits style props from render props', () => {
    const input = { layoutDisplay: 'flex', paddingX: '16px', id: 'component-1' };
    const { styleProps, rest } = splitStyleProps(input);
    expect(styleProps).toMatchObject({ layoutDisplay: 'flex', paddingX: '16px' });
    expect(rest).toMatchObject({ id: 'component-1' });
  });

  it('creates inline styles using spacing helpers', () => {
    const style = createInlineStyle({
      layoutDisplay: 'flex',
      marginX: '16px',
      paddingY: '24px',
      backgroundColor: '#FFFFFF'
    });
    expect(style.display).toBe('flex');
    expect(style.marginLeft).toBe('16px');
    expect(style.marginRight).toBe('16px');
    expect(style.paddingTop).toBe('24px');
    expect(style.paddingBottom).toBe('24px');
    expect(style.backgroundColor).toBe('#FFFFFF');
  });

  it('normalizes invalid colors before hitting the native picker', () => {
    expect(deriveColorPickerValue('#FFAA00')).toBe('#FFAA00');
    expect(deriveColorPickerValue('rgba(0,0,0,0.2)')).toBe('#111827');
  });

  it('builds safe DOM attribute props from user input', () => {
    const props = buildAttributeProps([
      { id: '1', name: ' data-testid ', value: 'hero-heading' },
      { id: '2', name: '1invalid', value: 'skip-me' },
      { id: '3', name: 'aria-label', value: 'Hero heading' }
    ]);
    expect(props).toEqual({ 'data-testid': 'hero-heading', 'aria-label': 'Hero heading' });
  });
});

describe('style-control custom fields', () => {
  it('emits updates when the color picker changes', () => {
    const fields = withStyleFields({});
    const colorField = fields.textColor;
    if (!colorField || colorField.type !== 'custom') {
      throw new Error('Expected textColor custom field');
    }
    const handleChange = jest.fn();
    render(
      colorField.render({
        field: colorField,
        value: '#111111',
        id: 'color-field',
        name: 'textColor',
        onChange: handleChange
      } as Parameters<NonNullable<typeof colorField.render>>[0])
    );
    fireEvent.change(screen.getByLabelText(/text color picker/i), { target: { value: '#ff0000' } });
    expect(handleChange).toHaveBeenCalledWith('#ff0000');
  });

  it('allows adding custom attributes through the sidebar field', () => {
    const fields = withStyleFields({});
    const attrField = fields.customAttributes;
    if (!attrField || attrField.type !== 'custom') {
      throw new Error('Expected customAttributes custom field');
    }
    const handleChange = jest.fn();
    render(
      attrField.render({
        field: attrField,
        value: [],
        id: 'attr-field',
        name: 'customAttributes',
        onChange: handleChange
      } as Parameters<NonNullable<typeof attrField.render>>[0])
    );
    fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
    expect(handleChange).toHaveBeenCalledWith(expect.any(Array));
    const [next] = handleChange.mock.calls[0];
    expect(Array.isArray(next)).toBe(true);
    expect(next[0]).toEqual(expect.objectContaining({ id: expect.any(String) }));
  });
});

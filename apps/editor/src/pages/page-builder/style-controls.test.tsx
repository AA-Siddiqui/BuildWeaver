import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  applyStylelessDefaults,
  buildAttributeProps,
  createDefaultGradientConfig,
  createInlineStyle,
  deriveColorPickerValue,
  isGradientValue,
  parseGradientValue,
  splitStyleProps,
  stringifyGradientConfig,
  STYLELESS_STYLE_DEFAULTS,
  withStyleFields,
  type StyleableProps
} from './style-controls';
import type { BindingOption } from './dynamic-binding';
import { PROPERTY_SEARCH_FIELD_KEY, resetPropertySearchState } from './property-search';

const bindingOptions: BindingOption[] = [];

describe('style-controls helpers', () => {
  it('appends shared style fields without mutating source', () => {
    const original = { foo: { type: 'text', label: 'Foo' } } as const;
    const extended = withStyleFields(original, bindingOptions);
    expect(extended.foo).toEqual(original.foo);
    expect(Object.keys(extended)[0]).toBe(PROPERTY_SEARCH_FIELD_KEY);
    expect(Object.keys(extended)).toEqual(expect.arrayContaining(['foo', 'layoutDisplay', 'padding', PROPERTY_SEARCH_FIELD_KEY]));
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
    expect(style.backgroundColor).toBe('#ffffff');
  });

  it('collapses zero-alpha colors to transparent inline styles', () => {
    const style = createInlineStyle({
      backgroundColor: 'rgba(255, 255, 255, 0)',
      borderColor: 'rgba(17, 17, 17, 0)',
      textColor: 'rgba(0, 0, 0, 0)'
    });
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe('transparent');
    expect(style.color).toBe('transparent');
  });

  it('normalizes invalid colors before hitting the native picker', () => {
    expect(deriveColorPickerValue('#FFAA00')).toBe('#ffaa00');
    expect(deriveColorPickerValue('rgba(0,0,0,0.2)')).toBe('#000000');
    expect(deriveColorPickerValue('#11182780')).toBe('#111827');
  });

  it('builds safe DOM attribute props from user input', () => {
    const props = buildAttributeProps([
      { id: '1', name: ' data-testid ', value: 'hero-heading' },
      { id: '2', name: '1invalid', value: 'skip-me' },
      { id: '3', name: 'aria-label', value: 'Hero heading' }
    ]);
    expect(props).toEqual({ 'data-testid': 'hero-heading', 'aria-label': 'Hero heading' });
  });

  it('round-trips gradient configs to CSS strings', () => {
    const config = createDefaultGradientConfig('#FFFFFF');
    const cssValue = stringifyGradientConfig(config);
    expect(isGradientValue(cssValue)).toBe(true);
    const parsed = parseGradientValue(cssValue);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('linear');
    expect(parsed?.stops).toHaveLength(config.stops.length);
  });

  it('applies gradients to inline styles for backgrounds and borders', () => {
    const gradient = 'linear-gradient(90deg, #111827 0%, #F9E7B2 100%)';
    const style = createInlineStyle({
      backgroundColor: gradient,
      borderColor: gradient,
      borderWidth: '2px'
    });
    expect(style.backgroundImage).toBe(gradient);
    expect(style.borderImageSource).toBe(gradient);
    expect(style.borderImageSlice).toBe(1);
  });

  it('parses gradients that mix rgba color stops', () => {
    const gradient = 'linear-gradient(45deg, rgba(17, 24, 39, 0.5) 0%, rgba(249, 231, 178, 0.8) 100%)';
    const parsed = parseGradientValue(gradient);
    expect(parsed).not.toBeNull();
    expect(parsed?.stops[0]?.color).toContain('rgba(17, 24, 39, 0.5)');
  });

  it('applies styleless defaults with informative logging', () => {
    type EmptyProps = StyleableProps<{ foo?: string }>;
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const defaults = applyStylelessDefaults<EmptyProps>('TestComponent', { padding: '12px' });
    expect(defaults.margin).toBe(STYLELESS_STYLE_DEFAULTS.margin);
    expect(defaults.backgroundColor).toBe(STYLELESS_STYLE_DEFAULTS.backgroundColor);
    expect(defaults.textColor).toBe(STYLELESS_STYLE_DEFAULTS.textColor);
    expect(defaults.padding).toBe('12px');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PageBuilder:StyleControls]'),
      expect.objectContaining({ component: 'TestComponent' })
    );
    consoleSpy.mockRestore();
  });
});

describe('style-control custom fields', () => {
  it('emits updates when the color picker changes', () => {
    const fields = withStyleFields({}, bindingOptions);
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
    fireEvent.change(screen.getByLabelText(/color picker/i), { target: { value: '#ff0000' } });
    expect(handleChange).toHaveBeenCalledWith('#ff0000');
  });

  it('allows adjusting alpha for solid colors', () => {
    const fields = withStyleFields({}, bindingOptions);
    const colorField = fields.textColor;
    if (!colorField || colorField.type !== 'custom') {
      throw new Error('Expected textColor custom field');
    }
    const handleChange = jest.fn();
    render(
      colorField.render({
        field: colorField,
        value: '#111111',
        id: 'color-field-alpha',
        name: 'textColor',
        onChange: handleChange
      } as Parameters<NonNullable<typeof colorField.render>>[0])
    );
    const alphaSlider = screen.getByLabelText(/^alpha/i);
    fireEvent.change(alphaSlider, { target: { value: '40' } });
    expect(handleChange).toHaveBeenLastCalledWith('rgba(17, 17, 17, 0.4)');
  });

  it('allows adding custom attributes through the sidebar field', () => {
    const fields = withStyleFields({}, bindingOptions);
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

  it('lets numeric style fields toggle between presets and custom values', () => {
    const fields = withStyleFields({}, bindingOptions);
    const widthField = fields.width;
    if (!widthField || widthField.type !== 'custom') {
      throw new Error('Expected width field to be custom');
    }
    const handleChange = jest.fn();
    render(
      widthField.render({
        field: widthField,
        value: '',
        id: 'width-field',
        name: 'width',
        onChange: handleChange
      } as Parameters<NonNullable<typeof widthField.render>>[0])
    );
    expect(screen.queryByLabelText(/custom value/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/preset options/i), { target: { value: '100%' } });
    expect(handleChange).toHaveBeenCalledWith('100%');
    fireEvent.change(screen.getByLabelText(/preset options/i), { target: { value: '__custom__' } });
    const customInput = screen.getByLabelText(/custom value/i);
    fireEvent.change(customInput, { target: { value: '640px' } });
    expect(handleChange).toHaveBeenLastCalledWith('640px');
  });

  it('captures custom CSS updates for scoped styling', () => {
    const fields = withStyleFields({}, bindingOptions);
    const cssField = fields.customCss;
    if (!cssField || cssField.type !== 'custom') {
      throw new Error('Expected customCss field to be custom');
    }
    const handleChange = jest.fn();
    render(
      cssField.render({
        field: cssField,
        value: '',
        id: 'css-field',
        name: 'customCss',
        onChange: handleChange
      } as Parameters<NonNullable<typeof cssField.render>>[0])
    );
    fireEvent.change(screen.getByLabelText(/custom css/i), { target: { value: 'color: red;' } });
    expect(handleChange).toHaveBeenCalledWith('color: red;');
  });

  it('switches to gradient mode and updates stops', () => {
    const fields = withStyleFields({}, bindingOptions);
    const colorField = fields.backgroundColor;
    if (!colorField || colorField.type !== 'custom') {
      throw new Error('Expected backgroundColor custom field');
    }
    const handleChange = jest.fn();
    render(
      colorField.render({
        field: colorField,
        value: '#111827',
        id: 'bg-color-field',
        name: 'backgroundColor',
        onChange: handleChange
      } as Parameters<NonNullable<typeof colorField.render>>[0])
    );
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'gradient' } });
    expect(handleChange).toHaveBeenCalledWith(expect.stringMatching(/linear-gradient/));
    const gradientInput = screen.getByLabelText(/gradient css/i);
    fireEvent.change(gradientInput, {
      target: { value: 'linear-gradient(45deg, #111827 0%, #F9E7B2 100%)' }
    });
    expect(handleChange).toHaveBeenLastCalledWith('linear-gradient(45deg, #111827 0%, #F9E7B2 100%)');
    fireEvent.click(screen.getByRole('button', { name: /add stop/i }));
    expect(handleChange).toHaveBeenLastCalledWith(expect.stringMatching(/linear-gradient/));
    const stopPositionInput = screen.getAllByLabelText(/position/i)[0];
    fireEvent.change(stopPositionInput, { target: { value: '0.25' } });
    expect(handleChange).toHaveBeenLastCalledWith(expect.stringMatching(/25%/));
  });

  it('captures gradient stop alpha adjustments', () => {
    const fields = withStyleFields({}, bindingOptions);
    const colorField = fields.backgroundColor;
    if (!colorField || colorField.type !== 'custom') {
      throw new Error('Expected backgroundColor custom field');
    }
    const handleChange = jest.fn();
    render(
      colorField.render({
        field: colorField,
        value: '#111827',
        id: 'bg-color-alpha-field',
        name: 'backgroundColor',
        onChange: handleChange
      } as Parameters<NonNullable<typeof colorField.render>>[0])
    );
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'gradient' } });
    const alphaSliders = screen.getAllByLabelText(/alpha stop/i);
    fireEvent.change(alphaSliders[0], { target: { value: '25' } });
    expect(handleChange).toHaveBeenLastCalledWith(expect.stringContaining('rgba(17, 24, 39, 0.25)'));
  });
});

describe('property search integration', () => {
  afterEach(() => {
    act(() => {
      resetPropertySearchState();
    });
  });

  const renderPropertySearchFixture = () => {
    const fields = withStyleFields({}, bindingOptions);
    const searchField = fields[PROPERTY_SEARCH_FIELD_KEY];
    const paddingField = fields.padding;
    const widthField = fields.width;

    if (
      !searchField ||
      searchField.type !== 'custom' ||
      typeof searchField.render !== 'function' ||
      !paddingField ||
      paddingField.type !== 'custom' ||
      typeof paddingField.render !== 'function' ||
      !widthField ||
      widthField.type !== 'custom' ||
      typeof widthField.render !== 'function'
    ) {
      throw new Error('Expected custom fields for property search fixture');
    }

    const paddingOnChange = jest.fn();
    const widthOnChange = jest.fn();

    const wrapField = (testId: string, node: ReactNode) => (
      <div data-testid={`field-shell-${testId}`}>{node}</div>
    );

    render(
      <>
        {wrapField(
          'search',
          searchField.render({
            field: searchField,
            value: '',
            id: 'property-search',
            name: PROPERTY_SEARCH_FIELD_KEY,
            onChange: jest.fn()
          } as Parameters<NonNullable<typeof searchField.render>>[0])
        )}
        {wrapField(
          'padding',
          paddingField.render({
            field: paddingField,
            value: '',
            id: 'padding-field',
            name: 'padding',
            onChange: paddingOnChange
          } as Parameters<NonNullable<typeof paddingField.render>>[0])
        )}
        {wrapField(
          'width',
          widthField.render({
            field: widthField,
            value: '',
            id: 'width-field',
            name: 'width',
            onChange: widthOnChange
          } as Parameters<NonNullable<typeof widthField.render>>[0])
        )}
      </>
    );

    const getShell = (fieldName: string) => screen.getByTestId(`field-shell-${fieldName}`);

    return { paddingOnChange, widthOnChange, getShell };
  };

  it('filters property controls when a query is entered', async () => {
    const { getShell } = renderPropertySearchFixture();
    const searchInput = screen.getByPlaceholderText(/search properties/i);
    fireEvent.change(searchInput, { target: { value: 'width' } });
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.queryByText('Padding')).toBeNull();
    await waitFor(() =>
      expect(getShell('padding')).toHaveAttribute('data-property-search-hidden', 'true')
    );
    await waitFor(() =>
      expect(getShell('width')).toHaveAttribute('data-property-search-visible', 'true')
    );
    fireEvent.change(searchInput, { target: { value: 'unknown' } });
    expect(screen.getByText(/no properties match "unknown"/i)).toBeInTheDocument();
  });

  it('still allows editing a filtered property', () => {
    const { paddingOnChange } = renderPropertySearchFixture();
    const searchInput = screen.getByPlaceholderText(/search properties/i);
    fireEvent.change(searchInput, { target: { value: 'padding' } });
    const paddingInput = screen.getByPlaceholderText('e.g. 64px');
    fireEvent.change(paddingInput, { target: { value: '72px' } });
    expect(paddingOnChange).toHaveBeenCalledWith('72px');
  });
});

import {
  STYLE_FIELD_KEYS,
  extractStyleProps,
  mapStylePropsToCss,
  cssObjectToJsxString,
  cssObjectToInlineStyleAttr
} from '../src/adapters/react/style-mapper';

describe('STYLE_FIELD_KEYS', () => {
  it('contains the expected number of style keys', () => {
    expect(STYLE_FIELD_KEYS.length).toBeGreaterThanOrEqual(25);
  });

  it('includes layout keys', () => {
    expect(STYLE_FIELD_KEYS).toContain('layoutDisplay');
    expect(STYLE_FIELD_KEYS).toContain('layoutDirection');
    expect(STYLE_FIELD_KEYS).toContain('justifyContent');
    expect(STYLE_FIELD_KEYS).toContain('alignItems');
    expect(STYLE_FIELD_KEYS).toContain('gap');
  });

  it('includes spacing axis keys', () => {
    expect(STYLE_FIELD_KEYS).toContain('marginX');
    expect(STYLE_FIELD_KEYS).toContain('marginY');
    expect(STYLE_FIELD_KEYS).toContain('paddingX');
    expect(STYLE_FIELD_KEYS).toContain('paddingY');
  });

  it('includes colour keys', () => {
    expect(STYLE_FIELD_KEYS).toContain('textColor');
    expect(STYLE_FIELD_KEYS).toContain('backgroundColor');
    expect(STYLE_FIELD_KEYS).toContain('borderColor');
  });
});

describe('extractStyleProps', () => {
  it('separates style and content props', () => {
    const props = {
      textColor: '#fff',
      fontSize: '16px',
      heading: 'Hello',
      description: 'world'
    };
    const { styleProps, contentProps } = extractStyleProps(props);
    expect(styleProps).toEqual({ textColor: '#fff', fontSize: '16px' });
    expect(contentProps).toEqual({ heading: 'Hello', description: 'world' });
  });

  it('handles empty props', () => {
    const { styleProps, contentProps } = extractStyleProps({});
    expect(Object.keys(styleProps)).toHaveLength(0);
    expect(Object.keys(contentProps)).toHaveLength(0);
  });

  it('puts unknown keys into contentProps', () => {
    const { styleProps, contentProps } = extractStyleProps({ randomKey: 42 });
    expect(styleProps).toEqual({});
    expect(contentProps).toEqual({ randomKey: 42 });
  });
});

describe('mapStylePropsToCss', () => {
  it('maps layout style props to CSS', () => {
    const css = mapStylePropsToCss({
      layoutDisplay: 'flex',
      layoutDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: '1rem'
    });
    expect(css).toMatchObject({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: '1rem'
    });
  });

  it('maps textColor to CSS color property', () => {
    const css = mapStylePropsToCss({ textColor: '#333' });
    expect(css['color']).toBe('#333');
    expect(css['textColor']).toBeUndefined();
  });

  it('maps plain backgroundColor to CSS backgroundColor', () => {
    const css = mapStylePropsToCss({ backgroundColor: '#f5f5f5' });
    expect(css['backgroundColor']).toBe('#f5f5f5');
    expect(css['backgroundImage']).toBeUndefined();
  });

  it('detects linear-gradient backgroundColor and maps to backgroundImage', () => {
    const css = mapStylePropsToCss({
      backgroundColor: 'linear-gradient(90deg, #000, #fff)'
    });
    expect(css['backgroundImage']).toBe('linear-gradient(90deg, #000, #fff)');
    expect(css['backgroundColor']).toBeUndefined();
  });

  it('detects radial-gradient backgroundColor and maps to backgroundImage', () => {
    const css = mapStylePropsToCss({
      backgroundColor: 'radial-gradient(circle, #000, #fff)'
    });
    expect(css['backgroundImage']).toBe('radial-gradient(circle, #000, #fff)');
    expect(css['backgroundColor']).toBeUndefined();
  });

  it('auto-adds borderStyle solid when borderWidth is greater than 0', () => {
    const css = mapStylePropsToCss({ borderWidth: '2px' });
    expect(css['borderWidth']).toBe('2px');
    expect(css['borderStyle']).toBe('solid');
  });

  it('does not add borderStyle when borderWidth is 0', () => {
    const css = mapStylePropsToCss({ borderWidth: '0' });
    expect(css['borderStyle']).toBeUndefined();
  });

  it('does not add borderStyle when borderWidth is 0px', () => {
    const css = mapStylePropsToCss({ borderWidth: '0px' });
    expect(css['borderStyle']).toBeUndefined();
  });

  it('expands marginX into marginLeft and marginRight', () => {
    const css = mapStylePropsToCss({ marginX: '2rem' });
    expect(css['marginLeft']).toBe('2rem');
    expect(css['marginRight']).toBe('2rem');
  });

  it('expands marginY into marginTop and marginBottom', () => {
    const css = mapStylePropsToCss({ marginY: '1rem' });
    expect(css['marginTop']).toBe('1rem');
    expect(css['marginBottom']).toBe('1rem');
  });

  it('expands paddingX into paddingLeft and paddingRight', () => {
    const css = mapStylePropsToCss({ paddingX: '0.5rem' });
    expect(css['paddingLeft']).toBe('0.5rem');
    expect(css['paddingRight']).toBe('0.5rem');
  });

  it('expands paddingY into paddingTop and paddingBottom', () => {
    const css = mapStylePropsToCss({ paddingY: '1.5rem' });
    expect(css['paddingTop']).toBe('1.5rem');
    expect(css['paddingBottom']).toBe('1.5rem');
  });

  it('skips empty and undefined values', () => {
    const css = mapStylePropsToCss({
      fontSize: '',
      lineHeight: undefined as unknown as string,
      textColor: ''
    });
    expect(Object.keys(css)).toHaveLength(0);
  });

  it('handles borderColor with gradient value', () => {
    const css = mapStylePropsToCss({
      borderColor: 'linear-gradient(90deg, red, blue)',
      borderWidth: '1px'
    });
    expect(css['borderImageSource']).toBe('linear-gradient(90deg, red, blue)');
    expect(css['borderImageSlice']).toBe('1');
    expect(css['borderColor']).toBeUndefined();
  });

  it('resolves dynamic binding fallback values', () => {
    const css = mapStylePropsToCss({
      textColor: {
        __bwDynamicBinding: true,
        bindingId: 'input-1',
        fallback: '#ff0000'
      } as unknown as string
    });
    expect(css['color']).toBe('#ff0000');
  });

  it('produces empty string for dynamic binding without fallback', () => {
    const css = mapStylePropsToCss({
      textColor: {
        __bwDynamicBinding: true,
        bindingId: 'input-1'
      } as unknown as string
    });
    expect(css['color']).toBeUndefined();
  });

  it('handles all typography properties', () => {
    const css = mapStylePropsToCss({
      fontSize: '18px',
      fontWeight: '700',
      lineHeight: '1.6',
      textAlign: 'center'
    });
    expect(css).toMatchObject({
      fontSize: '18px',
      fontWeight: '700',
      lineHeight: '1.6',
      textAlign: 'center'
    });
  });

  it('maps width, maxWidth, and minHeight', () => {
    const css = mapStylePropsToCss({
      width: '100%',
      maxWidth: '1200px',
      minHeight: '50vh'
    });
    expect(css).toMatchObject({
      width: '100%',
      maxWidth: '1200px',
      minHeight: '50vh'
    });
  });
});

describe('cssObjectToJsxString', () => {
  it('formats CSS object as JSX style prop', () => {
    const result = cssObjectToJsxString({ color: '#333', fontSize: '16px' }, 4);
    expect(result).toContain('style={{');
    expect(result).toContain('color: "#333"');
    expect(result).toContain('fontSize: "16px"');
    expect(result).toContain('}}');
  });

  it('returns empty string for empty CSS', () => {
    expect(cssObjectToJsxString({}, 0)).toBe('');
  });

  it('skips entries with empty values', () => {
    const result = cssObjectToJsxString({ color: '#333', display: '' }, 0);
    expect(result).toContain('color');
    expect(result).not.toContain('display');
  });

  it('converts kebab-case to camelCase', () => {
    const result = cssObjectToJsxString({ 'background-color': 'red' }, 0);
    expect(result).toContain('backgroundColor');
    expect(result).not.toContain('background-color');
  });
});

describe('cssObjectToInlineStyleAttr', () => {
  it('formats as inline style attribute', () => {
    const result = cssObjectToInlineStyleAttr({ color: '#333', fontSize: '16px' });
    expect(result).toMatch(/^style=\{\{/);
    expect(result).toContain('color: "#333"');
    expect(result).toContain('fontSize: "16px"');
  });

  it('returns empty string for empty CSS', () => {
    expect(cssObjectToInlineStyleAttr({})).toBe('');
  });
});

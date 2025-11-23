import { createInlineStyle, splitStyleProps, withStyleFields } from './style-controls';

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
});

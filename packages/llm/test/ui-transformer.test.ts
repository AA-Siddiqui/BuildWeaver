import { transformAiUiOutput, resetUiTransformerIdCounter, parseCssSpacing } from '../src/ui-transformer';
import { AI_DEFAULT_STYLE } from '../src/schemas/ui-generation';
import type { AiUiGenerationResult, AiComponentStyle } from '../src/schemas/ui-generation';

const S = AI_DEFAULT_STYLE;
const style = (overrides: Partial<AiComponentStyle> = {}): AiComponentStyle => ({ ...S, ...overrides });
const noop = () => {};

describe('transformAiUiOutput', () => {
  beforeEach(() => { resetUiTransformerIdCounter(); });

  it('should transform a single section with a heading', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading', content: 'Hello World', size: 'h1', style: S }] }], summary: 'Simple page' };
    const result = transformAiUiOutput(input);
    expect(result.summary).toBe('Simple page');
    expect(result.data.root).toEqual({ id: 'root', props: {}, children: [] });
    expect(result.data.content).toHaveLength(1);
    expect(result.data.content[0].type).toBe('Section');
    expect(result.data.content[0].props.backgroundColor).toBe('#FFFFFF');
    const sectionId = result.data.content[0].props.id as string;
    expect(sectionId).toMatch(/^section-ai-/);
    const zoneKey = sectionId + ':contentSlot';
    expect(result.data.zones).toBeDefined();
    expect(result.data.zones![zoneKey]).toHaveLength(1);
    expect(result.data.zones![zoneKey][0].type).toBe('Heading');
    expect(result.data.zones![zoneKey][0].props.content).toBe('Hello World');
    expect(result.data.zones![zoneKey][0].props.size).toBe('h1');
  });

  it('should transform multiple sections', () => {
    const input: AiUiGenerationResult = { sections: [
      { type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading', content: 'Hero', size: 'h1', style: S }] },
      { type: 'Section', backgroundColor: '#F0F0F0', style: S, children: [{ type: 'Paragraph', content: 'About', style: S }] }
    ], summary: 'Two sections' };
    const result = transformAiUiOutput(input);
    expect(result.data.content).toHaveLength(2);
    expect(result.data.content[0].type).toBe('Section');
    expect(result.data.content[1].type).toBe('Section');
  });

  it('should transform all leaf component types', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading', content: 'Title', size: 'h2', style: S }, { type: 'Paragraph', content: 'Body', style: S },
      { type: 'Button', label: 'Click', variant: 'primary', href: 'https://example.com', style: S },
      { type: 'Image', src: 'https://placehold.co/800x400', alt: 'Img', objectFit: 'cover', aspectRatio: '16/9', style: S },
      { type: 'Card', heading: 'Card', content: 'Content', eyebrow: 'New', imageUrl: '', actionLabel: '', actionHref: '', style: S },
      { type: 'List', items: [{ text: 'A', description: '' }, { text: 'B', description: 'Desc' }], variant: 'ordered', style: S },
      { type: 'Divider', style: S }, { type: 'Spacer', height: '48px', style: S }
    ] }], summary: 'All types' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const ch = result.data.zones![sid + ':contentSlot'];
    expect(ch).toHaveLength(8);
    expect(ch[0].type).toBe('Heading'); expect(ch[1].type).toBe('Paragraph');
    expect(ch[2].type).toBe('Button'); expect(ch[2].props.href).toBe('https://example.com');
    expect(ch[3].type).toBe('Image'); expect(ch[3].props.objectFit).toBe('cover'); expect(ch[3].props.aspectRatio).toBe('16/9');
    expect(ch[4].type).toBe('Card'); expect(ch[4].props.eyebrow).toBe('New');
    expect(ch[5].type).toBe('List'); expect(ch[5].props.items).toHaveLength(2); expect(ch[5].props.variant).toBe('ordered');
    expect(ch[6].type).toBe('Divider'); expect(ch[7].type).toBe('Spacer'); expect(ch[7].props.height).toBe('48px');
  });

  it('should transform columns into zones', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Columns', layout: 'wideLeft', style: S, left: [{ type: 'Heading', content: 'Left', size: 'h2', style: S }], right: [{ type: 'Paragraph', content: 'Right', style: S }] }
    ] }], summary: 'Columns test' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const sc = result.data.zones![sid + ':contentSlot'];
    expect(sc).toHaveLength(1); expect(sc[0].type).toBe('Columns');
    const cid = sc[0].props.id as string;
    expect(cid).toMatch(/^columns-ai-/); expect(sc[0].props.layout).toBe('wideLeft');
    expect(result.data.zones![cid + ':left']).toHaveLength(1);
    expect(result.data.zones![cid + ':left'][0].type).toBe('Heading');
    expect(result.data.zones![cid + ':right']).toHaveLength(1);
    expect(result.data.zones![cid + ':right'][0].type).toBe('Paragraph');
  });

  it('should generate unique IDs for all components', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading', content: 'A', size: 'h1', style: S }, { type: 'Heading', content: 'B', size: 'h2', style: S }
    ] }], summary: 'IDs test' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const ch = result.data.zones![sid + ':contentSlot'];
    const ids = new Set([sid, ch[0].props.id as string, ch[1].props.id as string]);
    expect(ids.size).toBe(3);
  });

  it('should set default section props when style is all defaults', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading', content: 'Test', size: 'h1', style: S }] }], summary: 'Defaults' };
    const result = transformAiUiOutput(input);
    const p = result.data.content[0].props;
    expect(p.minHeight).toBe('0'); expect(p.padding).toBe('0px'); expect(p.margin).toBe('0px'); expect(p.backgroundColor).toBe('#FFFFFF');
  });

  it('should use provided backgroundColor for section', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#1a1a2e', style: S, children: [{ type: 'Heading', content: 'Dark', size: 'h1', style: S }] }], summary: 'Dark section' };
    expect(transformAiUiOutput(input).data.content[0].props.backgroundColor).toBe('#1a1a2e');
  });

  it('should strip empty-string sentinel values from Button href', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button', label: 'Click', variant: 'ghost', href: '', style: S }] }], summary: 'Empty href' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    expect(result.data.zones![sid + ':contentSlot'][0].props.href).toBeUndefined();
  });

  it('should strip empty-string sentinel values from Card fields', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Card', heading: 'Card', content: 'Text', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: S }
    ] }], summary: 'Card sentinels' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const card = result.data.zones![sid + ':contentSlot'][0];
    expect(card.props.eyebrow).toBeUndefined(); expect(card.props.imageUrl).toBeUndefined();
    expect(card.props.actionLabel).toBeUndefined(); expect(card.props.actionHref).toBeUndefined();
  });

  it('should keep non-empty Card fields', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Card', heading: 'Full Card', content: 'Content', eyebrow: 'Featured', imageUrl: 'https://placehold.co/400', actionLabel: 'Learn more', actionHref: '/details', style: S }
    ] }], summary: 'Full card' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const card = result.data.zones![sid + ':contentSlot'][0];
    expect(card.props.heading).toBe('Full Card');
    expect(card.props.content).toBe('Content');
    expect(card.props.eyebrow).toBe('Featured');
    expect(card.props.imageUrl).toBe('https://placehold.co/400');
    expect(card.props.actionLabel).toBe('Learn more');
    expect(card.props.actionHref).toBe('/details');
  });

  it('should strip empty-string description from List items', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'List', items: [{ text: 'A', description: '' }, { text: 'B', description: 'Has desc' }], variant: 'unordered', style: S }
    ] }], summary: 'List descriptions' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const list = result.data.zones![sid + ':contentSlot'][0];
    const items = list.props.items as Array<{ text: string; description?: string }>;
    expect(items[0].description).toBeUndefined();
    expect(items[1].description).toBe('Has desc');
  });

  it('should always include objectFit and aspectRatio on Image', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Image', src: 'https://placehold.co/800x400', alt: 'Test', objectFit: 'contain', aspectRatio: 'auto', style: S }
    ] }], summary: 'Image fields' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const img = result.data.zones![sid + ':contentSlot'][0];
    expect(img.props.objectFit).toBe('contain');
    expect(img.props.aspectRatio).toBe('auto');
    expect(img.props.src).toBe('https://placehold.co/800x400');
    expect(img.props.alt).toBe('Test');
  });

  it('should call the logger during transformation', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading', content: 'Test', size: 'h1', style: S }] }], summary: 'Logger test' };
    transformAiUiOutput(input, logger);
    expect(logger).toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith('Starting UI transformation', expect.objectContaining({ sectionCount: 1, summary: 'Logger test' }));
    expect(logger).toHaveBeenCalledWith('UI transformation complete', expect.objectContaining({ contentItems: 1 }));
  });
  it('should log sentinel stripping info for Button', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button', label: 'Click', variant: 'primary', href: '', style: S }] }], summary: 'Button log' };
    transformAiUiOutput(input, logger);
    expect(logger).toHaveBeenCalledWith('Transforming Button component', expect.objectContaining({ hasHref: false }));
  });

  it('should log sentinel stripping info for Card', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Card', heading: 'Card', content: 'Text', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: S }
    ] }], summary: 'Card log' };
    transformAiUiOutput(input, logger);
    expect(logger).toHaveBeenCalledWith('Transforming Card component', expect.objectContaining({ hasEyebrow: false, hasImageUrl: false, hasActionLabel: false, hasActionHref: false }));
  });

  it('should work without a logger', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading', content: 'No logger', size: 'h1', style: S }] }], summary: 'No logger' };
    expect(() => transformAiUiOutput(input)).not.toThrow();
    const result = transformAiUiOutput(input);
    expect(result.data.content).toHaveLength(1);
  });

  // Style-specific tests

  it('should map style props to Heading component', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading', content: 'Styled', size: 'h1', style: style({ textColor: '#FF0000', fontSize: '3rem', fontWeight: '700' }) }
    ] }], summary: 'Styled heading' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const heading = result.data.zones![sid + ':contentSlot'][0];
    expect(heading.props.textColor).toBe('#FF0000');
    expect(heading.props.fontSize).toBe('3rem');
    expect(heading.props.fontWeight).toBe('700');
  });

  it('should decompose section two-value padding into paddingY and paddingX', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#1a1a2e', style: style({ textColor: '#FFFFFF', padding: '48px 64px' }), children: [
      { type: 'Heading', content: 'Dark hero', size: 'h1', style: S }
    ] }], summary: 'Styled section' };
    const result = transformAiUiOutput(input);
    const p = result.data.content[0].props;
    expect(p.textColor).toBe('#FFFFFF');
    // Two-value shorthand is decomposed: Y=48px, X=64px
    expect(p.paddingY).toBe('48px');
    expect(p.paddingX).toBe('64px');
    // The "all sides" padding is set to empty (axis values take precedence)
    expect(p.padding).toBe('');
  });

  it('should let section dedicated backgroundColor override style.backgroundColor', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#1a1a2e', style: style({ backgroundColor: '#FF0000' }), children: [
      { type: 'Heading', content: 'Override', size: 'h1', style: S }
    ] }], summary: 'BG override' };
    const result = transformAiUiOutput(input);
    expect(result.data.content[0].props.backgroundColor).toBe('#1a1a2e');
  });

  it('should NOT include sentinel style values in props', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading', content: 'Clean', size: 'h1', style: S }
    ] }], summary: 'No sentinels' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const heading = result.data.zones![sid + ':contentSlot'][0];
    const propKeys = Object.keys(heading.props);
    expect(propKeys).toContain('id');
    expect(propKeys).toContain('content');
    expect(propKeys).toContain('size');
    expect(propKeys).not.toContain('textColor');
    expect(propKeys).not.toContain('backgroundColor');
    expect(propKeys).not.toContain('padding');
    expect(propKeys).not.toContain('paddingX');
    expect(propKeys).not.toContain('paddingY');
    expect(propKeys).not.toContain('margin');
    expect(propKeys).not.toContain('marginX');
    expect(propKeys).not.toContain('marginY');
    expect(propKeys).not.toContain('fontSize');
    expect(propKeys).not.toContain('fontWeight');
    expect(propKeys).not.toContain('textAlign');
    expect(propKeys).not.toContain('borderRadius');
    expect(propKeys).not.toContain('boxShadow');
    expect(propKeys).not.toContain('maxWidth');
    expect(propKeys).not.toContain('opacity');
  });

  it('should decompose two-value padding on Button into per-axis props', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Button', label: 'Styled', variant: 'primary', href: '/signup', style: style({ padding: '12px 24px', borderRadius: '999px', backgroundColor: '#4F46E5', textColor: '#FFFFFF' }) }
    ] }], summary: 'Styled button' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const btn = result.data.zones![sid + ':contentSlot'][0];
    // Two-value shorthand → decomposed
    expect(btn.props.paddingY).toBe('12px');
    expect(btn.props.paddingX).toBe('24px');
    expect(btn.props.padding).toBe('');
    expect(btn.props.borderRadius).toBe('999px');
    expect(btn.props.backgroundColor).toBe('#4F46E5');
    expect(btn.props.textColor).toBe('#FFFFFF');
  });

  it('should keep single-value padding on Card as-is', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Card', heading: 'Styled Card', content: 'Content', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: style({ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '24px' }) }
    ] }], summary: 'Styled card' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const card = result.data.zones![sid + ':contentSlot'][0];
    expect(card.props.borderRadius).toBe('12px');
    expect(card.props.boxShadow).toBe('0 4px 12px rgba(0,0,0,0.08)');
    // Single value → all sides
    expect(card.props.padding).toBe('24px');
    expect(card.props.paddingX).toBe('');
    expect(card.props.paddingY).toBe('');
  });

  it('should keep single-value padding on Columns as-is', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Columns', layout: 'equal', style: style({ padding: '16px' }), left: [{ type: 'Paragraph', content: 'Left', style: S }], right: [{ type: 'Paragraph', content: 'Right', style: S }] }
    ] }], summary: 'Styled columns' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const cols = result.data.zones![sid + ':contentSlot'][0];
    expect(cols.props.padding).toBe('16px');
    expect(cols.props.paddingX).toBe('');
    expect(cols.props.paddingY).toBe('');
  });

  it('should decompose section two-value padding and margin into per-axis props', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: style({ padding: '64px 80px', margin: '0 auto' }), children: [
      { type: 'Heading', content: 'Padded', size: 'h1', style: S }
    ] }], summary: 'Styled section padding' };
    const result = transformAiUiOutput(input);
    const p = result.data.content[0].props;
    // Two-value padding shorthand → decomposed
    expect(p.paddingY).toBe('64px');
    expect(p.paddingX).toBe('80px');
    expect(p.padding).toBe('');
    // Two-value margin shorthand → decomposed
    expect(p.marginY).toBe('0');
    expect(p.marginX).toBe('auto');
    expect(p.margin).toBe('');
  });

  it('should log style mapping when styles are applied', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading', content: 'Styled', size: 'h1', style: style({ textColor: '#FF0000', fontSize: '3rem', fontWeight: '700' }) }
    ] }], summary: 'Log style' };
    transformAiUiOutput(input, logger);
    expect(logger).toHaveBeenCalledWith('Mapped style properties to component props', expect.objectContaining({ appliedCount: 3, keys: expect.arrayContaining(['textColor', 'fontSize', 'fontWeight']) }));
  });

  it('should log spacing parsing details', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: style({ padding: '48px 64px' }), children: [
      { type: 'Heading', content: 'Test', size: 'h1', style: S }
    ] }], summary: 'Spacing logs' };
    transformAiUiOutput(input, logger);
    expect(logger).toHaveBeenCalledWith(
      'parseCssSpacing: two values → Y (vertical) + X (horizontal)',
      expect.objectContaining({ raw: '48px 64px', y: '48px', x: '64px' })
    );
    expect(logger).toHaveBeenCalledWith(
      'Applying parsed spacing to props',
      expect.objectContaining({ field: 'padding', raw: '48px 64px', parsedX: '64px', parsedY: '48px' })
    );
  });
});

// ── parseCssSpacing unit tests ───────────────────────────────────

describe('parseCssSpacing', () => {
  it('should return empty result for empty string', () => {
    const result = parseCssSpacing('', noop);
    expect(result).toEqual({ all: '', x: '', y: '' });
  });

  it('should return empty result for whitespace-only string', () => {
    const result = parseCssSpacing('   ', noop);
    expect(result).toEqual({ all: '', x: '', y: '' });
  });

  it('should parse single value as all sides', () => {
    const result = parseCssSpacing('24px', noop);
    expect(result).toEqual({ all: '24px', x: '', y: '' });
  });

  it('should parse single value with leading/trailing whitespace', () => {
    const result = parseCssSpacing('  16px  ', noop);
    expect(result).toEqual({ all: '16px', x: '', y: '' });
  });

  it('should parse two values as Y (vertical) and X (horizontal)', () => {
    const result = parseCssSpacing('48px 64px', noop);
    expect(result).toEqual({ all: '', x: '64px', y: '48px' });
  });

  it('should parse "0 auto" for centring margins', () => {
    const result = parseCssSpacing('0 auto', noop);
    expect(result).toEqual({ all: '', x: 'auto', y: '0' });
  });

  it('should parse three values (lossy: uses top for Y, horizontal for X)', () => {
    const logger = jest.fn();
    const result = parseCssSpacing('10px 20px 30px', logger);
    expect(result).toEqual({ all: '', x: '20px', y: '10px' });
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('three-value'),
      expect.objectContaining({ top: '10px', horizontal: '20px', bottom: '30px' })
    );
  });

  it('should parse four values (lossy: uses top for Y, right for X)', () => {
    const logger = jest.fn();
    const result = parseCssSpacing('10px 20px 30px 40px', logger);
    expect(result).toEqual({ all: '', x: '20px', y: '10px' });
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('four-value'),
      expect.objectContaining({ top: '10px', right: '20px', bottom: '30px', left: '40px' })
    );
  });

  it('should handle unexpected multi-value format as single all value', () => {
    const result = parseCssSpacing('1px 2px 3px 4px 5px', noop);
    expect(result).toEqual({ all: '1px 2px 3px 4px 5px', x: '', y: '' });
  });

  it('should handle "0px" as single value', () => {
    const result = parseCssSpacing('0px', noop);
    expect(result).toEqual({ all: '0px', x: '', y: '' });
  });

  it('should log for single value parsing', () => {
    const logger = jest.fn();
    parseCssSpacing('32px', logger);
    expect(logger).toHaveBeenCalledWith(
      'parseCssSpacing: single value → all sides',
      expect.objectContaining({ all: '32px' })
    );
  });

  it('should log for two value parsing', () => {
    const logger = jest.fn();
    parseCssSpacing('12px 24px', logger);
    expect(logger).toHaveBeenCalledWith(
      'parseCssSpacing: two values → Y (vertical) + X (horizontal)',
      expect.objectContaining({ y: '12px', x: '24px' })
    );
  });

  it('should log for empty value parsing', () => {
    const logger = jest.fn();
    parseCssSpacing('', logger);
    expect(logger).toHaveBeenCalledWith(
      'parseCssSpacing: empty value received, returning empty result',
      expect.objectContaining({ raw: '' })
    );
  });
});

// ── Spacing integration tests (end-to-end through transformer) ──

describe('spacing integration', () => {
  beforeEach(() => { resetUiTransformerIdCounter(); });

  it('should correctly decompose section padding and override section defaults', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: style({ padding: '48px 64px' }), children: [
      { type: 'Heading', content: 'Test', size: 'h1', style: S }
    ] }], summary: 'Section padding' };
    const result = transformAiUiOutput(input);
    const p = result.data.content[0].props;
    // parseCssSpacing decomposed "48px 64px" → Y=48px, X=64px
    // These override the Section's hardcoded paddingX: "0px" and paddingY: "0px"
    expect(p.paddingX).toBe('64px');
    expect(p.paddingY).toBe('48px');
    // "all sides" padding is empty (not "0px") because the AI set per-axis
    expect(p.padding).toBe('');
  });

  it('should keep section defaults when no padding is specified', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading', content: 'Test', size: 'h1', style: S }
    ] }], summary: 'Default padding' };
    const result = transformAiUiOutput(input);
    const p = result.data.content[0].props;
    expect(p.padding).toBe('0px');
    expect(p.paddingX).toBe('0px');
    expect(p.paddingY).toBe('0px');
  });

  it('should decompose margin "0 auto" into per-axis props on section', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: style({ margin: '0 auto' }), children: [
      { type: 'Heading', content: 'Centred', size: 'h1', style: S }
    ] }], summary: 'Centred section' };
    const result = transformAiUiOutput(input);
    const p = result.data.content[0].props;
    expect(p.marginX).toBe('auto');
    expect(p.marginY).toBe('0');
    expect(p.margin).toBe('');
  });

  it('should correctly apply single-value padding on leaf components', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Card', heading: 'Padded', content: 'Text', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: style({ padding: '32px' }) }
    ] }], summary: 'Single padding' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const card = result.data.zones![sid + ':contentSlot'][0];
    expect(card.props.padding).toBe('32px');
    expect(card.props.paddingX).toBe('');
    expect(card.props.paddingY).toBe('');
  });

  it('should correctly apply two-value padding on leaf components', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Button', label: 'Go', variant: 'primary', href: '', style: style({ padding: '16px 32px' }) }
    ] }], summary: 'Two-value leaf padding' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const btn = result.data.zones![sid + ':contentSlot'][0];
    expect(btn.props.paddingY).toBe('16px');
    expect(btn.props.paddingX).toBe('32px');
    expect(btn.props.padding).toBe('');
  });

  it('should not produce padding/margin keys when style uses sentinel values', () => {
    const input: AiUiGenerationResult = { sections: [{ type: 'Section', backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Paragraph', content: 'No spacing', style: S }
    ] }], summary: 'No spacing' };
    const result = transformAiUiOutput(input);
    const sid = result.data.content[0].props.id as string;
    const para = result.data.zones![sid + ':contentSlot'][0];
    expect(para.props.padding).toBeUndefined();
    expect(para.props.paddingX).toBeUndefined();
    expect(para.props.paddingY).toBeUndefined();
    expect(para.props.margin).toBeUndefined();
    expect(para.props.marginX).toBeUndefined();
    expect(para.props.marginY).toBeUndefined();
  });
});

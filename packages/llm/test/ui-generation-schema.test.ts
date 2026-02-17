import { AiUiGenerationResultSchema, AI_DEFAULT_STYLE } from '../src/schemas/ui-generation';
import type { AiComponentStyle } from '../src/schemas/ui-generation';

const S = AI_DEFAULT_STYLE;
const style = (overrides: Partial<AiComponentStyle> = {}): AiComponentStyle => ({ ...S, ...overrides });

describe('AiUiGenerationResultSchema', () => {
  it('should accept a valid minimal UI result', () => {
    const input = {
      sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [
        { type: 'Heading' as const, content: 'Hello', size: 'h1' as const, style: S }
      ] }],
      summary: 'A simple heading page'
    };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections).toHaveLength(1);
      expect(result.data.sections[0].children).toHaveLength(1);
      expect(result.data.summary).toBe('A simple heading page');
    }
  });

  it('should accept all component types with required fields', () => {
    const input = {
      sections: [{ type: 'Section' as const, backgroundColor: '#1a1a2e', style: S, children: [
        { type: 'Heading' as const, content: 'Title', size: 'h1' as const, style: S },
        { type: 'Paragraph' as const, content: 'Body text', style: S },
        { type: 'Button' as const, label: 'Click', variant: 'primary' as const, href: 'https://example.com', style: S },
        { type: 'Image' as const, src: 'https://placehold.co/800x400', alt: 'Placeholder', objectFit: 'cover' as const, aspectRatio: 'auto' as const, style: S },
        { type: 'Card' as const, heading: 'Card', content: 'Card content', eyebrow: 'New', imageUrl: '', actionLabel: '', actionHref: '', style: S },
        { type: 'List' as const, items: [{ text: 'Item 1', description: '' }, { text: 'Item 2', description: 'Desc' }], variant: 'ordered' as const, style: S },
        { type: 'Divider' as const, style: S },
        { type: 'Spacer' as const, height: '48px' as const, style: S },
        { type: 'Columns' as const, layout: 'equal' as const, style: S, left: [{ type: 'Heading' as const, content: 'Left', size: 'h2' as const, style: S }], right: [{ type: 'Paragraph' as const, content: 'Right column', style: S }] }
      ] }],
      summary: 'Full component showcase'
    };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) { expect(result.data.sections[0].children).toHaveLength(9); }
  });

  it('should reject empty sections array', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [], summary: 'Empty' }).success).toBe(false);
  });

  it('should reject invalid component type', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'InvalidComponent', content: 'test', style: S }] }], summary: 'Invalid' }).success).toBe(false);
  });

  it('should reject invalid heading size', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Hello', size: 'h5', style: S }] }], summary: 'Invalid heading' }).success).toBe(false);
  });

  it('should reject invalid spacer height', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Spacer' as const, height: '999px', style: S }] }], summary: 'Invalid spacer' }).success).toBe(false);
  });

  it('should reject invalid button variant', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button' as const, label: 'Click', variant: 'danger', href: '', style: S }] }], summary: 'Invalid button' }).success).toBe(false);
  });

  it('should accept multiple sections', () => {
    const input = { sections: [
      { type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Hero', size: 'h1' as const, style: S }] },
      { type: 'Section' as const, backgroundColor: '#F0F0F0', style: S, children: [{ type: 'Paragraph' as const, content: 'About us', style: S }] },
      { type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button' as const, label: 'Contact', variant: 'primary' as const, href: '', style: S }] }
    ], summary: 'Multi-section page' };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sections).toHaveLength(3);
  });

  it('should require backgroundColor on section', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, style: S, children: [{ type: 'Heading' as const, content: 'No bg', size: 'h2' as const, style: S }] }], summary: 'Missing backgroundColor' }).success).toBe(false);
  });

  it('should accept card with all fields provided', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Card' as const, heading: 'Full Card', content: 'Content', eyebrow: 'Featured', imageUrl: 'https://placehold.co/400', actionLabel: 'Learn more', actionHref: '/details', style: S }] }], summary: 'Card test' }).success).toBe(true);
  });

  it('should accept card with empty-string sentinel values', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Card' as const, heading: 'Minimal Card', content: 'Just the basics', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: S }] }], summary: 'Card with empty sentinels' }).success).toBe(true);
  });

  it('should reject list with no items', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'List' as const, items: [], variant: 'unordered' as const, style: S }] }], summary: 'Empty list' }).success).toBe(false);
  });

  it('should accept columns with all layout options', () => {
    const layouts = ['equal', 'wideLeft', 'wideRight'] as const;
    for (const layout of layouts) {
      expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Columns' as const, layout, style: S, left: [{ type: 'Paragraph' as const, content: 'Left', style: S }], right: [{ type: 'Paragraph' as const, content: 'Right', style: S }] }] }], summary: 'Layout ' + layout }).success).toBe(true);
    }
  });

  it('should reject more than 10 sections', () => {
    const sections = Array.from({ length: 11 }, (_, i) => ({ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Section ' + i, size: 'h2' as const, style: S }] }));
    expect(AiUiGenerationResultSchema.safeParse({ sections, summary: 'Too many sections' }).success).toBe(false);
  });

  it('should accept image with all fields', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Image' as const, src: 'https://placehold.co/800x400', alt: 'Test', objectFit: 'contain' as const, aspectRatio: '16/9' as const, style: S }] }], summary: 'Image test' }).success).toBe(true);
  });

  it('should reject image missing objectFit', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Image' as const, src: 'https://placehold.co/800x400', alt: 'Test', aspectRatio: '16/9' as const, style: S }] }], summary: 'Missing objectFit' }).success).toBe(false);
  });

  it('should reject button missing href', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button' as const, label: 'Click', variant: 'primary' as const, style: S }] }], summary: 'Missing href' }).success).toBe(false);
  });

  it('should accept button with empty-string href sentinel', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button' as const, label: 'Click', variant: 'ghost' as const, href: '', style: S }] }], summary: 'Button with empty href' }).success).toBe(true);
  });

  it('should require summary field', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Test', size: 'h1' as const, style: S }] }] }).success).toBe(false);
  });

  it('should reject list missing variant', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'List' as const, items: [{ text: 'Item', description: '' }], style: S }] }], summary: 'Missing list variant' }).success).toBe(false);
  });

  it('should accept list item with empty-string description sentinel', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'List' as const, items: [{ text: 'A', description: '' }, { text: 'B', description: 'Has description' }], variant: 'unordered' as const, style: S }] }], summary: 'List with empty descriptions' }).success).toBe(true);
  });

  it('should have no optional fields in the generated JSON Schema', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Button' as const, label: 'Test', variant: 'primary' as const, href: '', style: S }, { type: 'Image' as const, src: 'https://placehold.co/400', alt: 'Test', objectFit: 'cover' as const, aspectRatio: 'auto' as const, style: S }, { type: 'Card' as const, heading: 'Card', content: 'Text', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: S }, { type: 'List' as const, items: [{ text: 'A', description: '' }], variant: 'plain' as const, style: S }] }], summary: 'All required fields test' }).success).toBe(true);
  });

  it('should require style object on section', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', children: [{ type: 'Heading' as const, content: 'Hello', size: 'h1' as const, style: S }] }], summary: 'Missing section style' }).success).toBe(false);
  });

  it('should require style object on leaf components', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Hello', size: 'h1' as const }] }], summary: 'Missing heading style' }).success).toBe(false);
  });

  it('should accept style with specific values', () => {
    const input = { sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Heading' as const, content: 'Styled', size: 'h1' as const, style: style({ fontSize: '2.25rem', fontWeight: '700', textAlign: 'center' }) }
    ] }], summary: 'Styled heading' };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const heading = result.data.sections[0].children[0];
      expect(heading.style.fontSize).toBe('2.25rem');
      expect(heading.style.fontWeight).toBe('700');
      expect(heading.style.textAlign).toBe('center');
    }
  });

  it('should reject invalid fontWeight enum value', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Bad weight', size: 'h1' as const, style: { ...S, fontWeight: '999' } }] }], summary: 'Invalid fontWeight' }).success).toBe(false);
  });

  it('should reject invalid textAlign enum value', () => {
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Bad align', size: 'h1' as const, style: { ...S, textAlign: 'justify' } }] }], summary: 'Invalid textAlign' }).success).toBe(false);
  });

  it('should accept all valid fontWeight values', () => {
    const validWeights = ['inherit', '300', '400', '500', '600', '700'] as const;
    for (const fontWeight of validWeights) {
      expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Weight ' + fontWeight, size: 'h1' as const, style: style({ fontWeight }) }] }], summary: 'fontWeight ' + fontWeight }).success).toBe(true);
    }
  });

  it('should accept all valid textAlign values', () => {
    const validAligns = ['inherit', 'left', 'center', 'right'] as const;
    for (const textAlign of validAligns) {
      expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Paragraph' as const, content: 'Align ' + textAlign, style: style({ textAlign }) }] }], summary: 'textAlign ' + textAlign }).success).toBe(true);
    }
  });

  it('should accept AI_DEFAULT_STYLE with all sentinel values', () => {
    expect(S.textColor).toBe('');
    expect(S.backgroundColor).toBe('');
    expect(S.padding).toBe('');
    expect(S.margin).toBe('');
    expect(S.fontSize).toBe('');
    expect(S.fontWeight).toBe('inherit');
    expect(S.textAlign).toBe('inherit');
    expect(S.borderRadius).toBe('');
    expect(S.borderWidth).toBe('');
    expect(S.borderColor).toBe('');
    expect(S.boxShadow).toBe('');
    expect(S.maxWidth).toBe('');
    expect(S.opacity).toBe('');
    expect(AiUiGenerationResultSchema.safeParse({ sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [{ type: 'Heading' as const, content: 'Default style', size: 'h1' as const, style: S }] }], summary: 'All default sentinels' }).success).toBe(true);
  });

  it('should accept styled Columns component', () => {
    const input = { sections: [{ type: 'Section' as const, backgroundColor: '#FFFFFF', style: S, children: [
      { type: 'Columns' as const, layout: 'equal' as const, style: style({ padding: '16px', backgroundColor: '#F3F4F6' }), left: [{ type: 'Heading' as const, content: 'Left', size: 'h2' as const, style: style({ textColor: '#111827' }) }], right: [{ type: 'Paragraph' as const, content: 'Right text', style: style({ fontSize: '1.125rem' }) }] }
    ] }], summary: 'Styled columns' };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const columns = result.data.sections[0].children[0];
      expect(columns.style.padding).toBe('16px');
      expect(columns.style.backgroundColor).toBe('#F3F4F6');
    }
  });

  it('should preserve style through full page validation (dark hero section)', () => {
    const input = { sections: [
      { type: 'Section' as const, backgroundColor: '#1a1a2e', style: style({ textColor: '#FFFFFF', padding: '48px 64px' }), children: [
        { type: 'Heading' as const, content: 'Welcome to BuildWeaver', size: 'h1' as const, style: style({ fontSize: '3rem', fontWeight: '700', textAlign: 'center' }) },
        { type: 'Paragraph' as const, content: 'Build beautiful pages with AI', style: style({ fontSize: '1.25rem', textAlign: 'center', opacity: '0.8' }) },
        { type: 'Button' as const, label: 'Get Started', variant: 'primary' as const, href: '/signup', style: style({ padding: '12px 24px', borderRadius: '999px', backgroundColor: '#4F46E5', textColor: '#FFFFFF' }) }
      ] },
      { type: 'Section' as const, backgroundColor: '#FFFFFF', style: style({ padding: '64px 80px' }), children: [
        { type: 'Heading' as const, content: 'Features', size: 'h2' as const, style: style({ textAlign: 'center', fontWeight: '600' }) },
        { type: 'Columns' as const, layout: 'equal' as const, style: style({ padding: '24px' }), left: [{ type: 'Card' as const, heading: 'AI Generation', content: 'Generate pages instantly', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: style({ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }) }], right: [{ type: 'Card' as const, heading: 'Visual Editor', content: 'Drag and drop editing', eyebrow: '', imageUrl: '', actionLabel: '', actionHref: '', style: style({ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }) }] }
      ] }
    ], summary: 'Dark hero with feature cards' };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections).toHaveLength(2);
      const heroSection = result.data.sections[0];
      expect(heroSection.style.textColor).toBe('#FFFFFF');
      expect(heroSection.style.padding).toBe('48px 64px');
      const heroHeading = heroSection.children[0];
      expect(heroHeading.style.fontSize).toBe('3rem');
      expect(heroHeading.style.fontWeight).toBe('700');
      expect(heroHeading.style.textAlign).toBe('center');
      const featureSection = result.data.sections[1];
      expect(featureSection.style.padding).toBe('64px 80px');
    }
  });
});

import { transformAiUiOutput, resetUiTransformerIdCounter } from '../src/ui-transformer';
import type { AiUiGenerationResult } from '../src/schemas/ui-generation';

describe('transformAiUiOutput', () => {
  beforeEach(() => {
    resetUiTransformerIdCounter();
  });

  it('should transform a single section with a heading', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Heading', content: 'Hello World', size: 'h1' }
          ]
        }
      ],
      summary: 'Simple page'
    };

    const result = transformAiUiOutput(input);

    expect(result.summary).toBe('Simple page');
    expect(result.data.root).toEqual({ id: 'root', props: {}, children: [] });
    expect(result.data.content).toHaveLength(1);
    expect(result.data.content[0].type).toBe('Section');
    expect(result.data.content[0].props.backgroundColor).toBe('#FFFFFF');

    // Section children go to zones
    const sectionId = result.data.content[0].props.id as string;
    expect(sectionId).toMatch(/^section-ai-/);

    const zoneKey = `${sectionId}:contentSlot`;
    expect(result.data.zones).toBeDefined();
    expect(result.data.zones![zoneKey]).toHaveLength(1);
    expect(result.data.zones![zoneKey][0].type).toBe('Heading');
    expect(result.data.zones![zoneKey][0].props.content).toBe('Hello World');
    expect(result.data.zones![zoneKey][0].props.size).toBe('h1');
  });

  it('should transform multiple sections', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Heading', content: 'Hero', size: 'h1' }]
        },
        {
          type: 'Section',
          backgroundColor: '#F0F0F0',
          children: [{ type: 'Paragraph', content: 'About' }]
        }
      ],
      summary: 'Two sections'
    };

    const result = transformAiUiOutput(input);

    expect(result.data.content).toHaveLength(2);
    expect(result.data.content[0].type).toBe('Section');
    expect(result.data.content[1].type).toBe('Section');
  });

  it('should transform all leaf component types', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Heading', content: 'Title', size: 'h2' },
            { type: 'Paragraph', content: 'Body' },
            { type: 'Button', label: 'Click', variant: 'primary', href: 'https://example.com' },
            { type: 'Image', src: 'https://placehold.co/800x400', alt: 'Img', objectFit: 'cover', aspectRatio: '16/9' },
            { type: 'Card', heading: 'Card', content: 'Content', eyebrow: 'New', imageUrl: '', actionLabel: '', actionHref: '' },
            { type: 'List', items: [{ text: 'A', description: '' }, { text: 'B', description: 'Desc' }], variant: 'ordered' },
            { type: 'Divider' },
            { type: 'Spacer', height: '48px' }
          ]
        }
      ],
      summary: 'All types'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];

    expect(children).toHaveLength(8);
    expect(children[0].type).toBe('Heading');
    expect(children[1].type).toBe('Paragraph');
    expect(children[2].type).toBe('Button');
    expect(children[2].props.href).toBe('https://example.com');
    expect(children[3].type).toBe('Image');
    expect(children[3].props.objectFit).toBe('cover');
    expect(children[3].props.aspectRatio).toBe('16/9');
    expect(children[4].type).toBe('Card');
    expect(children[4].props.eyebrow).toBe('New');
    expect(children[5].type).toBe('List');
    expect(children[5].props.items).toHaveLength(2);
    expect(children[5].props.variant).toBe('ordered');
    expect(children[6].type).toBe('Divider');
    expect(children[7].type).toBe('Spacer');
    expect(children[7].props.height).toBe('48px');
  });

  it('should transform columns into zones', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Columns',
              layout: 'wideLeft',
              left: [{ type: 'Heading', content: 'Left', size: 'h2' }],
              right: [{ type: 'Paragraph', content: 'Right' }]
            }
          ]
        }
      ],
      summary: 'Columns test'
    };

    const result = transformAiUiOutput(input);

    const sectionId = result.data.content[0].props.id as string;
    const sectionChildren = result.data.zones![`${sectionId}:contentSlot`];
    expect(sectionChildren).toHaveLength(1);
    expect(sectionChildren[0].type).toBe('Columns');

    const columnsId = sectionChildren[0].props.id as string;
    expect(columnsId).toMatch(/^columns-ai-/);
    expect(sectionChildren[0].props.layout).toBe('wideLeft');

    const leftChildren = result.data.zones![`${columnsId}:left`];
    const rightChildren = result.data.zones![`${columnsId}:right`];

    expect(leftChildren).toHaveLength(1);
    expect(leftChildren[0].type).toBe('Heading');
    expect(rightChildren).toHaveLength(1);
    expect(rightChildren[0].type).toBe('Paragraph');
  });

  it('should generate unique IDs for all components', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Heading', content: 'A', size: 'h1' },
            { type: 'Heading', content: 'B', size: 'h2' }
          ]
        }
      ],
      summary: 'IDs test'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];

    const ids = new Set([
      sectionId,
      children[0].props.id as string,
      children[1].props.id as string
    ]);

    expect(ids.size).toBe(3);
  });

  it('should set default section props', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Heading', content: 'Test', size: 'h1' }]
        }
      ],
      summary: 'Defaults'
    };

    const result = transformAiUiOutput(input);
    const sectionProps = result.data.content[0].props;

    expect(sectionProps.minHeight).toBe('0');
    expect(sectionProps.padding).toBe('0px');
    expect(sectionProps.margin).toBe('0px');
    expect(sectionProps.backgroundColor).toBe('#FFFFFF');
  });

  it('should use provided backgroundColor for section', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#1a1a2e',
          children: [{ type: 'Heading', content: 'Dark', size: 'h1' }]
        }
      ],
      summary: 'Dark section'
    };

    const result = transformAiUiOutput(input);
    expect(result.data.content[0].props.backgroundColor).toBe('#1a1a2e');
  });

  it('should strip empty-string sentinel values from Button href', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Button', label: 'Click', variant: 'ghost', href: '' }
          ]
        }
      ],
      summary: 'Empty href'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];

    expect(children[0].props.href).toBeUndefined();
  });

  it('should strip empty-string sentinel values from Card fields', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Card',
              heading: 'Card',
              content: 'Text',
              eyebrow: '',
              imageUrl: '',
              actionLabel: '',
              actionHref: ''
            }
          ]
        }
      ],
      summary: 'Card sentinels'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];

    expect(children[0].props.eyebrow).toBeUndefined();
    expect(children[0].props.imageUrl).toBeUndefined();
    expect(children[0].props.actionLabel).toBeUndefined();
    expect(children[0].props.actionHref).toBeUndefined();
  });

  it('should keep non-empty Card optional-like fields', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Card',
              heading: 'Full Card',
              content: 'Text',
              eyebrow: 'New',
              imageUrl: 'https://img.com/pic.jpg',
              actionLabel: 'Learn more',
              actionHref: '/details'
            }
          ]
        }
      ],
      summary: 'Full card'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];

    expect(children[0].props.eyebrow).toBe('New');
    expect(children[0].props.imageUrl).toBe('https://img.com/pic.jpg');
    expect(children[0].props.actionLabel).toBe('Learn more');
    expect(children[0].props.actionHref).toBe('/details');
  });

  it('should strip empty-string description from List items', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'List',
              items: [
                { text: 'A', description: '' },
                { text: 'B', description: 'Has desc' }
              ],
              variant: 'unordered'
            }
          ]
        }
      ],
      summary: 'List sentinels'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];
    const items = children[0].props.items as Array<{ text: string; description?: string }>;

    expect(items[0].description).toBeUndefined();
    expect(items[1].description).toBe('Has desc');
  });

  it('should always include objectFit and aspectRatio on Image', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Image', src: 'https://placehold.co/400', alt: 'Img', objectFit: 'cover', aspectRatio: 'auto' }
          ]
        }
      ],
      summary: 'Image defaults'
    };

    const result = transformAiUiOutput(input);
    const sectionId = result.data.content[0].props.id as string;
    const children = result.data.zones![`${sectionId}:contentSlot`];

    expect(children[0].props.objectFit).toBe('cover');
    expect(children[0].props.aspectRatio).toBe('auto');
  });

  it('should call the logger during transformation', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Heading', content: 'Logged', size: 'h1' }]
        }
      ],
      summary: 'Logger test'
    };

    transformAiUiOutput(input, logger);

    expect(logger).toHaveBeenCalledWith(
      'Starting UI transformation',
      expect.objectContaining({ sectionCount: 1 })
    );
    expect(logger).toHaveBeenCalledWith(
      'UI transformation complete',
      expect.objectContaining({ contentItems: 1 })
    );
    expect(logger).toHaveBeenCalledWith(
      'Transforming Section',
      expect.objectContaining({ childCount: 1 })
    );
    expect(logger).toHaveBeenCalledWith(
      'Transforming Heading component',
      expect.objectContaining({ size: 'h1' })
    );
  });

  it('should log sentinel stripping info for Button', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Button', label: 'Click', variant: 'primary', href: '' }]
        }
      ],
      summary: 'Logger sentinel test'
    };

    transformAiUiOutput(input, logger);

    expect(logger).toHaveBeenCalledWith(
      'Transforming Button component',
      expect.objectContaining({ hasHref: false })
    );
  });

  it('should log sentinel stripping info for Card', () => {
    const logger = jest.fn();
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Card',
              heading: 'C',
              content: 'T',
              eyebrow: 'E',
              imageUrl: '',
              actionLabel: '',
              actionHref: ''
            }
          ]
        }
      ],
      summary: 'Logger card test'
    };

    transformAiUiOutput(input, logger);

    expect(logger).toHaveBeenCalledWith(
      'Transforming Card component',
      expect.objectContaining({
        hasEyebrow: true,
        hasImageUrl: false,
        hasActionLabel: false,
        hasActionHref: false
      })
    );
  });

  it('should work without a logger', () => {
    const input: AiUiGenerationResult = {
      sections: [
        {
          type: 'Section',
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Heading', content: 'No logger', size: 'h1' }]
        }
      ],
      summary: 'No logger'
    };

    expect(() => transformAiUiOutput(input)).not.toThrow();
  });
});

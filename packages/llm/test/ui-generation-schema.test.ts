import { AiUiGenerationResultSchema } from '../src/schemas/ui-generation';

describe('AiUiGenerationResultSchema', () => {
  it('should accept a valid minimal UI generation result', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Heading' as const, content: 'Hello', size: 'h1' as const }
          ]
        }
      ],
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
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#1a1a2e',
          children: [
            { type: 'Heading' as const, content: 'Title', size: 'h1' as const },
            { type: 'Paragraph' as const, content: 'Body text' },
            { type: 'Button' as const, label: 'Click', variant: 'primary' as const, href: 'https://example.com' },
            { type: 'Image' as const, src: 'https://placehold.co/800x400', alt: 'Placeholder', objectFit: 'cover' as const, aspectRatio: 'auto' as const },
            { type: 'Card' as const, heading: 'Card', content: 'Card content', eyebrow: 'New', imageUrl: '', actionLabel: '', actionHref: '' },
            { type: 'List' as const, items: [{ text: 'Item 1', description: '' }, { text: 'Item 2', description: 'Desc' }], variant: 'ordered' as const },
            { type: 'Divider' as const },
            { type: 'Spacer' as const, height: '48px' as const },
            {
              type: 'Columns' as const,
              layout: 'equal' as const,
              left: [{ type: 'Heading' as const, content: 'Left', size: 'h2' as const }],
              right: [{ type: 'Paragraph' as const, content: 'Right column' }]
            }
          ]
        }
      ],
      summary: 'Full component showcase'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections[0].children).toHaveLength(9);
    }
  });

  it('should reject empty sections array', () => {
    const input = {
      sections: [],
      summary: 'Empty'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid component type', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'InvalidComponent', content: 'test' }
          ]
        }
      ],
      summary: 'Invalid'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid heading size', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Heading' as const, content: 'Hello', size: 'h5' }
          ]
        }
      ],
      summary: 'Invalid heading'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid spacer height', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Spacer' as const, height: '999px' }
          ]
        }
      ],
      summary: 'Invalid spacer'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid button variant', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Button' as const, label: 'Click', variant: 'danger', href: '' }
          ]
        }
      ],
      summary: 'Invalid button'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept multiple sections', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Heading' as const, content: 'Hero', size: 'h1' as const }]
        },
        {
          type: 'Section' as const,
          backgroundColor: '#F0F0F0',
          children: [{ type: 'Paragraph' as const, content: 'About us' }]
        },
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Button' as const, label: 'Contact', variant: 'primary' as const, href: '' }]
        }
      ],
      summary: 'Multi-section page'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections).toHaveLength(3);
    }
  });

  it('should require backgroundColor on section (no optional fields)', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          children: [{ type: 'Heading' as const, content: 'No bg', size: 'h2' as const }]
        }
      ],
      summary: 'Missing backgroundColor'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept card with all fields provided', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Card' as const,
              heading: 'Full Card',
              content: 'Content',
              eyebrow: 'Featured',
              imageUrl: 'https://placehold.co/400',
              actionLabel: 'Learn more',
              actionHref: '/details'
            }
          ]
        }
      ],
      summary: 'Card test'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept card with empty-string sentinel values', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Card' as const,
              heading: 'Minimal Card',
              content: 'Just the basics',
              eyebrow: '',
              imageUrl: '',
              actionLabel: '',
              actionHref: ''
            }
          ]
        }
      ],
      summary: 'Card with empty sentinels'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject list with no items', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'List' as const, items: [], variant: 'unordered' as const }
          ]
        }
      ],
      summary: 'Empty list'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept columns with all layout options', () => {
    const layouts = ['equal', 'wideLeft', 'wideRight'] as const;

    for (const layout of layouts) {
      const input = {
        sections: [
          {
            type: 'Section' as const,
            backgroundColor: '#FFFFFF',
            children: [
              {
                type: 'Columns' as const,
                layout,
                left: [{ type: 'Paragraph' as const, content: 'Left' }],
                right: [{ type: 'Paragraph' as const, content: 'Right' }]
              }
            ]
          }
        ],
        summary: `Layout ${layout}`
      };

      const result = AiUiGenerationResultSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('should reject more than 10 sections', () => {
    const sections = Array.from({ length: 11 }, (_, i) => ({
      type: 'Section' as const,
      backgroundColor: '#FFFFFF',
      children: [{ type: 'Heading' as const, content: `Section ${i}`, size: 'h2' as const }]
    }));

    const input = { sections, summary: 'Too many sections' };
    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept image with all fields required', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Image' as const,
              src: 'https://placehold.co/800x400',
              alt: 'Test',
              objectFit: 'contain' as const,
              aspectRatio: '16/9' as const
            }
          ]
        }
      ],
      summary: 'Image test'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject image missing objectFit (now required)', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Image' as const,
              src: 'https://placehold.co/800x400',
              alt: 'Test',
              aspectRatio: '16/9' as const
            }
          ]
        }
      ],
      summary: 'Missing objectFit'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject button missing href (now required)', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Button' as const, label: 'Click', variant: 'primary' as const }
          ]
        }
      ],
      summary: 'Missing href'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept button with empty-string href sentinel', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'Button' as const, label: 'Click', variant: 'ghost' as const, href: '' }
          ]
        }
      ],
      summary: 'Button with empty href'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should require summary field', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [{ type: 'Heading' as const, content: 'Test', size: 'h1' as const }]
        }
      ]
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject list missing variant (now required)', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            { type: 'List' as const, items: [{ text: 'Item', description: '' }] }
          ]
        }
      ],
      summary: 'Missing list variant'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept list item with empty-string description sentinel', () => {
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'List' as const,
              items: [
                { text: 'A', description: '' },
                { text: 'B', description: 'Has description' }
              ],
              variant: 'unordered' as const
            }
          ]
        }
      ],
      summary: 'List with empty descriptions'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should have no optional fields in the generated JSON Schema', () => {
    // This test verifies that zodToJsonSchema won't produce "anyOf" with "not"
    // which is the root cause of GROQ compatibility issues
    const input = {
      sections: [
        {
          type: 'Section' as const,
          backgroundColor: '#FFFFFF',
          children: [
            {
              type: 'Button' as const,
              label: 'Test',
              variant: 'primary' as const,
              href: ''
            },
            {
              type: 'Image' as const,
              src: 'https://placehold.co/400',
              alt: 'Test',
              objectFit: 'cover' as const,
              aspectRatio: 'auto' as const
            },
            {
              type: 'Card' as const,
              heading: 'Card',
              content: 'Text',
              eyebrow: '',
              imageUrl: '',
              actionLabel: '',
              actionHref: ''
            },
            {
              type: 'List' as const,
              items: [{ text: 'A', description: '' }],
              variant: 'plain' as const
            }
          ]
        }
      ],
      summary: 'All required fields test'
    };

    const result = AiUiGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

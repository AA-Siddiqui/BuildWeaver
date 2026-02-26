import { emitComponent, emitContentArray } from '../src/adapters/react/component-emitter';
import type { PuckComponentData, PageDynamicInputInfo } from '../src/adapters/react/types';

const noInputs: PageDynamicInputInfo[] = [];
const noZones: Record<string, PuckComponentData[]> = {};

const makeComponent = (
  type: string,
  props: Record<string, unknown> = {},
  id?: string
): PuckComponentData => ({
  type,
  props: { id: id ?? `test-${type.toLowerCase()}`, ...props }
});

describe('emitComponent', () => {
  describe('Heading', () => {
    it('emits an h2 tag by default', () => {
      const result = emitComponent(
        makeComponent('Heading', { content: 'Hello World' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<h2');
      expect(result).toContain('Hello World');
      expect(result).toContain('</h2>');
    });

    it('emits the correct heading tag based on size prop', () => {
      const result = emitComponent(
        makeComponent('Heading', { content: 'Title', size: 'h1' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<h1');
      expect(result).toContain('</h1>');
    });

    it('handles dynamic text content', () => {
      const inputs: PageDynamicInputInfo[] = [
        { id: 'title-input', label: 'Page Title', dataType: 'string' }
      ];
      const result = emitComponent(
        makeComponent('Heading', {
          content: {
            __bwDynamicBinding: true,
            bindingId: 'title-input'
          }
        }),
        noZones,
        inputs,
        0
      );
      expect(result).toContain('{pageData?.Page_Title}');
    });

    it('includes style props', () => {
      const result = emitComponent(
        makeComponent('Heading', { content: 'Styled', textColor: '#ff0000' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('color: "#ff0000"');
    });
  });

  describe('Paragraph', () => {
    it('emits a p tag with content', () => {
      const result = emitComponent(
        makeComponent('Paragraph', { content: 'Body text here' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<p');
      expect(result).toContain('Body text here');
      expect(result).toContain('</p>');
    });

    it('includes default fontSize and lineHeight', () => {
      const result = emitComponent(
        makeComponent('Paragraph', { content: 'text' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('fontSize: "1rem"');
      expect(result).toContain('lineHeight: "1.6"');
    });
  });

  describe('Button', () => {
    it('emits a button when no href is provided', () => {
      const result = emitComponent(
        makeComponent('Button', { label: 'Click me' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<button');
      expect(result).toContain('Click me');
      expect(result).toContain('type="button"');
    });

    it('emits an anchor tag when href is provided', () => {
      const result = emitComponent(
        makeComponent('Button', { label: 'Go', href: 'https://example.com' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Go');
    });

    it('applies primary variant styles by default', () => {
      const result = emitComponent(
        makeComponent('Button', { label: 'Primary' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('#DDC57A');
    });

    it('applies ghost variant styles', () => {
      const result = emitComponent(
        makeComponent('Button', { label: 'Ghost', variant: 'ghost' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('transparent');
      expect(result).toContain('1px solid');
    });
  });

  describe('Image', () => {
    it('emits a figure with img tag', () => {
      const result = emitComponent(
        makeComponent('Image', { src: '/hero.jpg', alt: 'Hero image' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<figure');
      expect(result).toContain('<img');
      expect(result).toContain('src="/hero.jpg"');
      expect(result).toContain('alt="Hero image"');
      expect(result).toContain('</figure>');
    });

    it('uses placeholder when no src is provided', () => {
      const result = emitComponent(
        makeComponent('Image', {}),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('placehold.co');
    });

    it('emits figcaption when caption is provided', () => {
      const result = emitComponent(
        makeComponent('Image', { src: '/img.png', caption: 'My caption' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<figcaption');
      expect(result).toContain('My caption');
    });

    it('applies objectFit and aspectRatio', () => {
      const result = emitComponent(
        makeComponent('Image', { src: '/img.png', objectFit: 'contain', aspectRatio: '4 / 3' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('objectFit: "contain"');
      expect(result).toContain('aspectRatio: "4 / 3"');
    });
  });

  describe('Section', () => {
    it('emits a section tag', () => {
      const result = emitComponent(
        makeComponent('Section', { heading: 'My Section' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<section');
      expect(result).toContain('My Section');
      expect(result).toContain('</section>');
    });

    it('emits eyebrow text', () => {
      const result = emitComponent(
        makeComponent('Section', { eyebrow: 'FEATURED' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('FEATURED');
      expect(result).toContain('textTransform: "uppercase"');
    });

    it('renders zone children from contentSlot', () => {
      const zones = {
        'sec-1:contentSlot': [
          makeComponent('Heading', { content: 'Child heading' }, 'child-h1')
        ]
      };
      const result = emitComponent(
        makeComponent('Section', {}, 'sec-1'),
        zones,
        noInputs,
        0
      );
      expect(result).toContain('Child heading');
    });
  });

  describe('Columns', () => {
    it('emits a grid container with two column divs', () => {
      const result = emitComponent(
        makeComponent('Columns', { layout: 'equal' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('gridTemplateColumns: "1fr 1fr"');
      expect(result).toContain('display: "grid"');
    });

    it('applies wideLeft layout', () => {
      const result = emitComponent(
        makeComponent('Columns', { layout: 'wideLeft' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('gridTemplateColumns: "3fr 2fr"');
    });

    it('applies stack class for responsive behavior', () => {
      const result = emitComponent(
        makeComponent('Columns', { stackAt: 'md' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('className="bw-stack-md"');
    });

    it('renders left and right zone children', () => {
      const zones = {
        'col-1:left': [makeComponent('Heading', { content: 'Left' }, 'left-h')],
        'col-1:right': [makeComponent('Paragraph', { content: 'Right' }, 'right-p')]
      };
      const result = emitComponent(
        makeComponent('Columns', {}, 'col-1'),
        zones,
        noInputs,
        0
      );
      expect(result).toContain('Left');
      expect(result).toContain('Right');
    });
  });

  describe('Card', () => {
    it('emits an article tag with card structure', () => {
      const result = emitComponent(
        makeComponent('Card', { heading: 'Card Title', content: 'Card body' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<article');
      expect(result).toContain('Card Title');
      expect(result).toContain('Card body');
      expect(result).toContain('</article>');
    });

    it('renders card image when imageUrl is provided', () => {
      const result = emitComponent(
        makeComponent('Card', { imageUrl: '/card.jpg' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<img');
      expect(result).toContain('src="/card.jpg"');
    });

    it('renders action link when both label and href are provided', () => {
      const result = emitComponent(
        makeComponent('Card', { actionLabel: 'Read more', actionHref: '/post/1' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<a');
      expect(result).toContain('Read more');
      expect(result).toContain('/post/1');
    });
  });

  describe('Divider', () => {
    it('emits an hr tag', () => {
      const result = emitComponent(
        makeComponent('Divider', {}),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<hr');
    });

    it('includes default border-top style', () => {
      const result = emitComponent(
        makeComponent('Divider', {}),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('borderTop');
    });
  });

  describe('Spacer', () => {
    it('emits a div with aria-hidden and default height', () => {
      const result = emitComponent(
        makeComponent('Spacer', {}),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<div');
      expect(result).toContain('aria-hidden="true"');
      expect(result).toContain('height: "48px"');
    });

    it('uses custom height when provided', () => {
      const result = emitComponent(
        makeComponent('Spacer', { height: '100px' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('height: "100px"');
    });
  });

  describe('List', () => {
    it('emits a ul for bullet variant with built-in items', () => {
      const result = emitComponent(
        makeComponent('List', {
          variant: 'bullet',
          renderMode: 'builtIn',
          items: [{ text: 'Item 1' }, { text: 'Item 2' }]
        }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<ul');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).toContain('</ul>');
    });

    it('emits an ol for numbered variant', () => {
      const result = emitComponent(
        makeComponent('List', {
          variant: 'numbered',
          renderMode: 'builtIn',
          items: [{ text: 'First' }]
        }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<ol');
      expect(result).toContain('</ol>');
    });

    it('renders dynamic data source with .map()', () => {
      const inputs: PageDynamicInputInfo[] = [
        { id: 'list-data', label: 'Todo Items', dataType: 'list' }
      ];
      const result = emitComponent(
        makeComponent('List', {
          variant: 'bullet',
          renderMode: 'builtIn',
          dataSource: { __bwDynamicBinding: true, bindingId: 'list-data' }
        }),
        noZones,
        inputs,
        0
      );
      expect(result).toContain('.map(');
      expect(result).toContain('pageData?.Todo_Items');
    });
  });

  describe('Conditional', () => {
    it('emits static case when activeCaseKey is a plain string', () => {
      const zones = {
        'cond-1:cases-0-slot': [makeComponent('Heading', { content: 'Case A' }, 'h-a')],
        'cond-1:cases-1-slot': [makeComponent('Heading', { content: 'Case B' }, 'h-b')]
      };
      const result = emitComponent(
        makeComponent('Conditional', {
          activeCaseKey: 'primary',
          cases: [{ caseKey: 'primary' }, { caseKey: 'secondary' }]
        }, 'cond-1'),
        zones,
        noInputs,
        0
      );
      expect(result).toContain('Case A');
      expect(result).not.toContain('Case B');
    });

    it('emits IIFE switch for dynamic activeCaseKey', () => {
      const inputs: PageDynamicInputInfo[] = [
        { id: 'case-input', label: 'Active Tab', dataType: 'string' }
      ];
      const result = emitComponent(
        makeComponent('Conditional', {
          activeCaseKey: { __bwDynamicBinding: true, bindingId: 'case-input' },
          cases: [{ caseKey: 'tab1' }, { caseKey: 'tab2' }]
        }, 'cond-2'),
        noZones,
        inputs,
        0
      );
      expect(result).toContain('(() => {');
      expect(result).toContain('activeCase');
      expect(result).toContain('"tab1"');
      expect(result).toContain('"tab2"');
    });

    it('emits a comment when no cases are defined', () => {
      const result = emitComponent(
        makeComponent('Conditional', { cases: [] }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('no cases defined');
    });
  });

  describe('Fallback', () => {
    it('emits a div with comment for unknown component type', () => {
      const result = emitComponent(
        makeComponent('UnknownWidget', { label: 'test' }),
        noZones,
        noInputs,
        0
      );
      expect(result).toContain('<div');
      expect(result).toContain('Unknown component: UnknownWidget');
    });
  });
});

describe('emitContentArray', () => {
  it('emits a comment for empty content array', () => {
    const result = emitContentArray([], noZones, noInputs, 0);
    expect(result).toContain('No components on this page');
  });

  it('emits multiple components joined with newlines', () => {
    const content: PuckComponentData[] = [
      makeComponent('Heading', { content: 'Title' }, 'h-1'),
      makeComponent('Paragraph', { content: 'Body' }, 'p-1')
    ];
    const result = emitContentArray(content, noZones, noInputs, 0);
    expect(result).toContain('Title');
    expect(result).toContain('Body');
    expect(result.split('\n').length).toBeGreaterThan(1);
  });
});

describe('data-bw-node attributes', () => {
  it('adds data-bw-node to components with id', () => {
    const result = emitComponent(
      makeComponent('Heading', { content: 'Test' }, 'my-node-id'),
      noZones,
      noInputs,
      0
    );
    expect(result).toContain('data-bw-node="my-node-id"');
  });
});

describe('customCss', () => {
  it('emits scoped style tag when customCss is present', () => {
    const result = emitComponent(
      makeComponent('Heading', { content: 'Styled', customCss: 'font-style: italic;' }, 'styled-h'),
      noZones,
      noInputs,
      0
    );
    expect(result).toContain('<style');
    expect(result).toContain('data-bw-node="styled-h"');
    expect(result).toContain('font-style: italic;');
  });
});

import { normalizePuckSlots } from '../src/adapters/react/slot-normalizer';
import type { PuckComponentData, PuckData } from '../src/adapters/react/types';

const makeComponent = (
  type: string,
  props: Record<string, unknown>,
  id?: string
): PuckComponentData => ({
  type,
  props: { id: id ?? `test-${type.toLowerCase()}`, ...props }
});

const makePuckData = (
  content: PuckComponentData[],
  zones?: Record<string, PuckComponentData[]>
): PuckData => ({
  root: { props: {} },
  content,
  zones
});

describe('normalizePuckSlots', () => {
  describe('passthrough cases', () => {
    it('returns data unchanged when content is empty', () => {
      const data = makePuckData([]);
      const result = normalizePuckSlots(data);
      expect(Object.keys(result.zones ?? {}).length).toBe(0);
    });

    it('returns data unchanged when no inline slots exist', () => {
      const data = makePuckData([
        makeComponent('Heading', { content: 'Hello' }, 'h1'),
        makeComponent('Paragraph', { content: 'World' }, 'p1')
      ]);
      const result = normalizePuckSlots(data);
      expect(Object.keys(result.zones ?? {}).length).toBe(0);
    });

    it('preserves existing zone entries', () => {
      const data = makePuckData(
        [makeComponent('Section', {}, 'sec-1')],
        {
          'sec-1:contentSlot': [
            makeComponent('Heading', { content: 'Already in zones' }, 'h-exist')
          ]
        }
      );
      const result = normalizePuckSlots(data);
      expect(result.zones!['sec-1:contentSlot']).toHaveLength(1);
      expect(result.zones!['sec-1:contentSlot'][0].props.id).toBe('h-exist');
    });
  });

  describe('Section contentSlot extraction', () => {
    it('extracts inline contentSlot children to zones', () => {
      const childHeading = makeComponent('Heading', { content: 'Nested Title' }, 'child-h1');
      const section = makeComponent('Section', {
        heading: 'My Section',
        contentSlot: [childHeading]
      }, 'sec-1');

      const data = makePuckData([section]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['sec-1:contentSlot']).toBeDefined();
      expect(result.zones!['sec-1:contentSlot']).toHaveLength(1);
      expect(result.zones!['sec-1:contentSlot'][0].type).toBe('Heading');
      expect(result.zones!['sec-1:contentSlot'][0].props.id).toBe('child-h1');
    });

    it('extracts multiple children from contentSlot', () => {
      const section = makeComponent('Section', {
        contentSlot: [
          makeComponent('Heading', { content: 'Title' }, 'h1'),
          makeComponent('Paragraph', { content: 'Text' }, 'p1'),
          makeComponent('Button', { label: 'Click' }, 'btn1')
        ]
      }, 'sec-1');

      const data = makePuckData([section]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['sec-1:contentSlot']).toHaveLength(3);
    });
  });

  describe('Columns left/right extraction', () => {
    it('extracts inline left and right slot children', () => {
      const columns = makeComponent('Columns', {
        layout: 'equal',
        left: [makeComponent('Heading', { content: 'Left Col' }, 'left-h')],
        right: [makeComponent('Paragraph', { content: 'Right Col' }, 'right-p')]
      }, 'col-1');

      const data = makePuckData([columns]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['col-1:left']).toHaveLength(1);
      expect(result.zones!['col-1:left'][0].type).toBe('Heading');
      expect(result.zones!['col-1:right']).toHaveLength(1);
      expect(result.zones!['col-1:right'][0].type).toBe('Paragraph');
    });

    it('handles one empty and one populated column', () => {
      const columns = makeComponent('Columns', {
        left: [makeComponent('Heading', { content: 'Only Left' }, 'left-h')],
        right: []
      }, 'col-2');

      const data = makePuckData([columns]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['col-2:left']).toHaveLength(1);
      expect(result.zones!['col-2:right']).toBeUndefined();
    });
  });

  describe('List customItemSlot extraction', () => {
    it('extracts inline customItemSlot children', () => {
      const list = makeComponent('List', {
        renderMode: 'custom',
        dataSource: { __bwDynamicBinding: true, bindingId: 'items' },
        customItemSlot: [
          makeComponent('Heading', { content: 'Item Title' }, 'item-h'),
          makeComponent('Paragraph', { content: 'Item Desc' }, 'item-p')
        ]
      }, 'list-1');

      const data = makePuckData([list]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['list-1:customItemSlot']).toHaveLength(2);
    });
  });

  describe('Conditional cases slot extraction', () => {
    it('extracts inline slot children from cases array', () => {
      const cond = makeComponent('Conditional', {
        activeCaseKey: 'tab1',
        cases: [
          {
            caseKey: 'tab1',
            slot: [makeComponent('Heading', { content: 'Tab 1 Content' }, 'tab1-h')]
          },
          {
            caseKey: 'tab2',
            slot: [makeComponent('Paragraph', { content: 'Tab 2 Content' }, 'tab2-p')]
          }
        ]
      }, 'cond-1');

      const data = makePuckData([cond]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['cond-1:cases-0-slot']).toHaveLength(1);
      expect(result.zones!['cond-1:cases-0-slot'][0].type).toBe('Heading');
      expect(result.zones!['cond-1:cases-1-slot']).toHaveLength(1);
      expect(result.zones!['cond-1:cases-1-slot'][0].type).toBe('Paragraph');
    });

    it('handles cases with empty slots', () => {
      const cond = makeComponent('Conditional', {
        activeCaseKey: 'a',
        cases: [
          { caseKey: 'a', slot: [makeComponent('Heading', { content: 'A' }, 'a-h')] },
          { caseKey: 'b', slot: [] }
        ]
      }, 'cond-2');

      const data = makePuckData([cond]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['cond-2:cases-0-slot']).toHaveLength(1);
      expect(result.zones!['cond-2:cases-1-slot']).toBeUndefined();
    });
  });

  describe('deeply nested slot extraction', () => {
    it('extracts slots from nested components recursively', () => {
      // Section > Columns > Heading (3 levels)
      const heading = makeComponent('Heading', { content: 'Deep Heading' }, 'deep-h');
      const columns = makeComponent('Columns', {
        left: [heading],
        right: []
      }, 'nested-col');
      const section = makeComponent('Section', {
        heading: 'Outer',
        contentSlot: [columns]
      }, 'outer-sec');

      const data = makePuckData([section]);
      const result = normalizePuckSlots(data);

      // Section's contentSlot should be extracted
      expect(result.zones!['outer-sec:contentSlot']).toHaveLength(1);
      expect(result.zones!['outer-sec:contentSlot'][0].type).toBe('Columns');

      // Columns' left slot (nested inside Section) should also be extracted
      expect(result.zones!['nested-col:left']).toHaveLength(1);
      expect(result.zones!['nested-col:left'][0].type).toBe('Heading');
    });

    it('handles 4 levels of nesting', () => {
      // Section > Columns > Section > Heading
      const innerHeading = makeComponent('Heading', { content: 'Deepest' }, 'h-deep');
      const innerSection = makeComponent('Section', {
        contentSlot: [innerHeading]
      }, 'inner-sec');
      const columns = makeComponent('Columns', {
        left: [innerSection]
      }, 'mid-col');
      const outerSection = makeComponent('Section', {
        contentSlot: [columns]
      }, 'outer-sec');

      const data = makePuckData([outerSection]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['outer-sec:contentSlot']).toHaveLength(1);
      expect(result.zones!['mid-col:left']).toHaveLength(1);
      expect(result.zones!['inner-sec:contentSlot']).toHaveLength(1);
      expect(result.zones!['inner-sec:contentSlot'][0].props.id).toBe('h-deep');
    });
  });

  describe('idempotency', () => {
    it('does not overwrite existing zone entries with inline data', () => {
      const section = makeComponent('Section', {
        contentSlot: [makeComponent('Heading', { content: 'Inline' }, 'inline-h')]
      }, 'sec-1');

      const existingZones = {
        'sec-1:contentSlot': [
          makeComponent('Paragraph', { content: 'Already in zones' }, 'existing-p')
        ]
      };

      const data = makePuckData([section], existingZones);
      const result = normalizePuckSlots(data);

      // Existing zone entry should be preserved, not overwritten
      expect(result.zones!['sec-1:contentSlot']).toHaveLength(1);
      expect(result.zones!['sec-1:contentSlot'][0].props.id).toBe('existing-p');
    });
  });

  describe('edge cases', () => {
    it('skips components without an id', () => {
      const section: PuckComponentData = {
        type: 'Section',
        props: {
          heading: 'No ID',
          contentSlot: [makeComponent('Heading', { content: 'Child' }, 'child-h')]
        }
      };

      const data = makePuckData([section]);
      const result = normalizePuckSlots(data);
      expect(Object.keys(result.zones ?? {}).length).toBe(0);
    });

    it('handles non-array slot values gracefully', () => {
      const section = makeComponent('Section', {
        contentSlot: 'not-an-array'
      }, 'sec-1');

      const data = makePuckData([section]);
      const result = normalizePuckSlots(data);
      expect(result.zones!['sec-1:contentSlot']).toBeUndefined();
    });

    it('handles multiple top-level components with inline slots', () => {
      const sec1 = makeComponent('Section', {
        contentSlot: [makeComponent('Heading', { content: 'First' }, 'h-1')]
      }, 'sec-1');
      const sec2 = makeComponent('Section', {
        contentSlot: [makeComponent('Paragraph', { content: 'Second' }, 'p-2')]
      }, 'sec-2');

      const data = makePuckData([sec1, sec2]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['sec-1:contentSlot']).toHaveLength(1);
      expect(result.zones!['sec-2:contentSlot']).toHaveLength(1);
    });

    it('detects unknown inline slot arrays for unregistered component types', () => {
      const custom = makeComponent('FutureComponent', {
        mySlot: [makeComponent('Heading', { content: 'In custom slot' }, 'h-custom')]
      }, 'fc-1');

      const data = makePuckData([custom]);
      const result = normalizePuckSlots(data);

      expect(result.zones!['fc-1:mySlot']).toHaveLength(1);
    });
  });
});

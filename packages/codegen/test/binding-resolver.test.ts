import {
  isDynamicBinding,
  generateBindingExpression,
  resolveTextContent,
  collectPageBindings,
  resolveBindingIdToLabel
} from '../src/adapters/react/binding-resolver';
import type { DynamicBindingState, PageDynamicInputInfo, PuckData } from '../src/adapters/react/types';

const makeBinding = (
  bindingId: string,
  opts?: { fallback?: string; propertyPath?: string[] }
): DynamicBindingState => ({
  __bwDynamicBinding: true,
  bindingId,
  ...opts
});

const sampleInputs: PageDynamicInputInfo[] = [
  { id: 'input-1', label: 'User Name', dataType: 'string' },
  { id: 'input-2', label: 'Items List', dataType: 'list' },
  { id: 'input-3', label: 'Profile Data', dataType: 'object' }
];

describe('isDynamicBinding', () => {
  it('returns true for a valid binding object', () => {
    expect(isDynamicBinding(makeBinding('input-1'))).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDynamicBinding(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDynamicBinding(undefined)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isDynamicBinding('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isDynamicBinding(42)).toBe(false);
  });

  it('returns false for an object without the marker', () => {
    expect(isDynamicBinding({ bindingId: 'x' })).toBe(false);
  });

  it('returns false for an object with marker set to false', () => {
    expect(isDynamicBinding({ __bwDynamicBinding: false, bindingId: 'x' })).toBe(false);
  });
});

describe('generateBindingExpression', () => {
  it('generates a simple expression for a known input', () => {
    const result = generateBindingExpression(makeBinding('input-1'), sampleInputs);
    expect(result).toBe('pageData?.User_Name');
  });

  it('generates an expression with property path', () => {
    const result = generateBindingExpression(
      makeBinding('input-3', { propertyPath: ['address', 'city'] }),
      sampleInputs
    );
    expect(result).toBe('pageData?.Profile_Data?.address?.city');
  });

  it('includes fallback with nullish coalescing when provided', () => {
    const result = generateBindingExpression(
      makeBinding('input-1', { fallback: 'Anonymous' }),
      sampleInputs
    );
    expect(result).toBe('(pageData?.User_Name) ?? "Anonymous"');
  });

  it('handles both property path and fallback', () => {
    const result = generateBindingExpression(
      makeBinding('input-3', { propertyPath: ['nested'], fallback: 'default' }),
      sampleInputs
    );
    expect(result).toBe('(pageData?.Profile_Data?.nested) ?? "default"');
  });

  it('uses the bindingId as label fallback for unknown inputs', () => {
    const result = generateBindingExpression(makeBinding('unknown-id'), []);
    expect(result).toContain('pageData?.unknown_id');
  });

  it('sanitizes special characters in labels', () => {
    const inputs: PageDynamicInputInfo[] = [
      { id: 'input-special', label: 'user@email.com', dataType: 'string' }
    ];
    const result = generateBindingExpression(makeBinding('input-special'), inputs);
    expect(result).not.toContain('@');
    expect(result).toBe('pageData?.user_email_com');
  });

  it('sanitizes labels starting with a digit', () => {
    const inputs: PageDynamicInputInfo[] = [
      { id: 'input-num', label: '3rdValue', dataType: 'string' }
    ];
    const result = generateBindingExpression(makeBinding('input-num'), inputs);
    expect(result).toMatch(/pageData\?\._3rdValue/);
  });
});

describe('resolveTextContent', () => {
  it('returns expression for a dynamic binding', () => {
    const result = resolveTextContent(makeBinding('input-1'), sampleInputs);
    expect(result.isExpression).toBe(true);
    expect(result.text).toContain('pageData?.User_Name');
  });

  it('returns plain text for a string value', () => {
    const result = resolveTextContent('Hello World', []);
    expect(result.isExpression).toBe(false);
    expect(result.text).toBe('Hello World');
  });

  it('returns empty text for undefined', () => {
    const result = resolveTextContent(undefined, []);
    expect(result.isExpression).toBe(false);
    expect(result.text).toBe('');
  });

  it('returns empty text for null', () => {
    const result = resolveTextContent(null, []);
    expect(result.isExpression).toBe(false);
    expect(result.text).toBe('');
  });

  it('returns empty text for a number', () => {
    const result = resolveTextContent(42, []);
    expect(result.isExpression).toBe(false);
    expect(result.text).toBe('');
  });
});

describe('collectPageBindings', () => {
  it('returns empty set for undefined data', () => {
    const result = collectPageBindings(undefined);
    expect(result.size).toBe(0);
  });

  it('returns empty set when content is empty', () => {
    const puckData: PuckData = {
      root: { props: {} },
      content: []
    };
    const result = collectPageBindings(puckData);
    expect(result.size).toBe(0);
  });

  it('collects binding IDs from top-level component props', () => {
    const puckData: PuckData = {
      root: { props: {} },
      content: [
        {
          type: 'Heading',
          props: {
            id: 'h1',
            content: makeBinding('input-1')
          }
        }
      ]
    };
    const result = collectPageBindings(puckData);
    expect(result.has('input-1')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('collects binding IDs from zone children', () => {
    const puckData: PuckData = {
      root: { props: {} },
      content: [
        {
          type: 'Section',
          props: { id: 'section-1' }
        }
      ],
      zones: {
        'section-1:contentSlot': [
          {
            type: 'Paragraph',
            props: {
              id: 'p1',
              content: makeBinding('input-2')
            }
          }
        ]
      }
    };
    const result = collectPageBindings(puckData);
    expect(result.has('input-2')).toBe(true);
  });

  it('returns unique binding IDs when same binding used multiple times', () => {
    const puckData: PuckData = {
      root: { props: {} },
      content: [
        {
          type: 'Heading',
          props: { id: 'h1', content: makeBinding('input-1') }
        },
        {
          type: 'Paragraph',
          props: { id: 'p1', content: makeBinding('input-1') }
        }
      ]
    };
    const result = collectPageBindings(puckData);
    expect(result.size).toBe(1);
    expect(result.has('input-1')).toBe(true);
  });

  it('collects multiple unique binding IDs across components', () => {
    const puckData: PuckData = {
      root: { props: {} },
      content: [
        {
          type: 'Heading',
          props: { id: 'h1', content: makeBinding('input-1') }
        },
        {
          type: 'Paragraph',
          props: { id: 'p1', content: makeBinding('input-2') }
        }
      ]
    };
    const result = collectPageBindings(puckData);
    expect(result.size).toBe(2);
    expect(result.has('input-1')).toBe(true);
    expect(result.has('input-2')).toBe(true);
  });

  it('walks deeply nested zone structure', () => {
    const puckData: PuckData = {
      root: { props: {} },
      content: [
        { type: 'Section', props: { id: 'sec-1' } }
      ],
      zones: {
        'sec-1:contentSlot': [
          { type: 'Columns', props: { id: 'col-1' } }
        ],
        'col-1:left': [
          { type: 'Heading', props: { id: 'h1', content: makeBinding('deep-input') } }
        ]
      }
    };
    const result = collectPageBindings(puckData);
    expect(result.has('deep-input')).toBe(true);
  });
});

describe('resolveBindingIdToLabel', () => {
  it('returns sanitized label for a known input', () => {
    const result = resolveBindingIdToLabel('input-1', sampleInputs);
    expect(result).toBe('User_Name');
  });

  it('returns sanitized binding ID for an unknown input', () => {
    const result = resolveBindingIdToLabel('unknown', []);
    expect(result).toBe('unknown');
  });
});

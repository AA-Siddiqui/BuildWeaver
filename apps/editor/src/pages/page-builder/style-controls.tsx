import { useId } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import type { CustomField, Field, FieldProps } from '@measured/puck';

const STYLE_LOG_PREFIX = '[PageBuilder:StyleControls]';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const DEFAULT_COLOR_FALLBACK = '#111827';

type ColorPickerFieldConfig = {
  label: string;
  placeholder?: string;
  fieldKey: string;
};

export type CustomAttribute = {
  id: string;
  name?: string;
  value?: string;
};

export type CustomAttributeList = CustomAttribute[];

const logStyleControlEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }
  console.info(`${STYLE_LOG_PREFIX} ${message}`, details ?? '');
};

const safeRandomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 9);
};

const isValidHexColor = (value?: string): value is string => HEX_COLOR_PATTERN.test(value ?? '');

export const deriveColorPickerValue = (value?: string, fallback = DEFAULT_COLOR_FALLBACK) =>
  isValidHexColor(value) ? value : fallback;

const createColorPickerField = ({ label, placeholder, fieldKey }: ColorPickerFieldConfig): Field<string> => ({
  type: 'custom',
  label,
  render: (props) => <ColorPickerFieldControl {...props} placeholder={placeholder} fieldKey={fieldKey} />
});

const createCustomAttributesField = (): Field<CustomAttributeList> => ({
  type: 'custom',
  label: 'Custom attributes',
  render: (props) => <CustomAttributesFieldControl {...props} />
});

const spacingOptions = [
  { label: 'None (0px)', value: '0px' },
  { label: 'XS (4px)', value: '4px' },
  { label: 'SM (8px)', value: '8px' },
  { label: 'MD (16px)', value: '16px' },
  { label: 'LG (24px)', value: '24px' },
  { label: 'XL (32px)', value: '32px' },
  { label: '2XL (48px)', value: '48px' },
  { label: '3XL (64px)', value: '64px' }
] as const;

const widthOptions = [
  { label: 'Auto', value: '' },
  { label: 'Full (100%)', value: '100%' },
  { label: 'Wide (1200px)', value: '1200px' },
  { label: 'Content (960px)', value: '960px' },
  { label: 'Half (50%)', value: '50%' }
] as const;

const minHeightOptions = [
  { label: 'Auto', value: '' },
  { label: 'Hero (480px)', value: '480px' },
  { label: 'Tall (360px)', value: '360px' },
  { label: 'Compact (240px)', value: '240px' }
] as const;

const fontSizeOptions = [
  { label: 'Inherit', value: '' },
  { label: 'XS • 0.75rem', value: '0.75rem' },
  { label: 'SM • 0.875rem', value: '0.875rem' },
  { label: 'Base • 1rem', value: '1rem' },
  { label: 'LG • 1.25rem', value: '1.25rem' },
  { label: 'XL • 1.5rem', value: '1.5rem' },
  { label: '2XL • 1.875rem', value: '1.875rem' },
  { label: '3XL • 2.25rem', value: '2.25rem' },
  { label: 'Display • 3rem', value: '3rem' }
] as const;

const fontWeightOptions = [
  { label: 'Inherit', value: '' },
  { label: 'Light (300)', value: '300' },
  { label: 'Normal (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Semibold (600)', value: '600' },
  { label: 'Bold (700)', value: '700' }
] as const;

const borderRadiusOptions = [
  { label: 'Sharp (0px)', value: '0px' },
  { label: 'Subtle (6px)', value: '6px' },
  { label: 'Rounded (12px)', value: '12px' },
  { label: 'Pill (999px)', value: '999px' }
] as const;

const borderWidthOptions = [
  { label: 'None', value: '' },
  { label: 'Hairline (1px)', value: '1px' },
  { label: 'Regular (2px)', value: '2px' },
  { label: 'Bold (4px)', value: '4px' }
] as const;

const shadowOptions = [
  { label: 'None', value: '' },
  { label: 'Soft', value: '0 15px 35px rgba(15, 23, 42, 0.08)' },
  { label: 'Lifted', value: '0 25px 55px rgba(15, 23, 42, 0.15)' }
] as const;

const baseStyleFields = {
  layoutDisplay: {
    type: 'select',
    label: 'Layout / Display',
    options: [
      { label: 'Inherit', value: '' },
      { label: 'Block', value: 'block' },
      { label: 'Flex', value: 'flex' },
      { label: 'Inline flex', value: 'inline-flex' },
      { label: 'Grid', value: 'grid' }
    ]
  },
  layoutDirection: {
    type: 'select',
    label: 'Layout / Direction',
    options: [
      { label: 'Row', value: 'row' },
      { label: 'Row reverse', value: 'row-reverse' },
      { label: 'Column', value: 'column' },
      { label: 'Column reverse', value: 'column-reverse' }
    ]
  },
  layoutWrap: {
    type: 'select',
    label: 'Layout / Wrap',
    options: [
      { label: 'No wrap', value: 'nowrap' },
      { label: 'Wrap', value: 'wrap' }
    ]
  },
  justifyContent: {
    type: 'select',
    label: 'Layout / Justify',
    options: [
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' },
      { label: 'Space between', value: 'space-between' },
      { label: 'Space around', value: 'space-around' },
      { label: 'Space evenly', value: 'space-evenly' }
    ]
  },
  alignItems: {
    type: 'select',
    label: 'Layout / Align',
    options: [
      { label: 'Stretch', value: 'stretch' },
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' }
    ]
  },
  gap: {
    type: 'select',
    label: 'Layout / Gap',
    options: spacingOptions
  },
  position: {
    type: 'select',
    label: 'Position',
    options: [
      { label: 'Static', value: 'static' },
      { label: 'Relative', value: 'relative' },
      { label: 'Absolute', value: 'absolute' }
    ]
  },
  textAlign: {
    type: 'select',
    label: 'Text align',
    options: [
      { label: 'Inherit', value: '' },
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
      { label: 'Justify', value: 'justify' }
    ]
  },
  fontSize: {
    type: 'select',
    label: 'Font size',
    options: fontSizeOptions
  },
  fontWeight: {
    type: 'select',
    label: 'Font weight',
    options: fontWeightOptions
  },
  lineHeight: {
    type: 'select',
    label: 'Line height',
    options: [
      { label: 'Inherit', value: '' },
      { label: 'Tight (1.1)', value: '1.1' },
      { label: 'Snug (1.3)', value: '1.3' },
      { label: 'Relaxed (1.6)', value: '1.6' }
    ]
  },
  width: {
    type: 'select',
    label: 'Width',
    options: widthOptions
  },
  maxWidth: {
    type: 'select',
    label: 'Max width',
    options: widthOptions
  },
  minHeight: {
    type: 'select',
    label: 'Min height',
    options: minHeightOptions
  },
  margin: {
    type: 'select',
    label: 'Margin (all)',
    options: spacingOptions
  },
  marginX: {
    type: 'select',
    label: 'Margin X',
    options: spacingOptions
  },
  marginY: {
    type: 'select',
    label: 'Margin Y',
    options: spacingOptions
  },
  padding: {
    type: 'select',
    label: 'Padding (all)',
    options: spacingOptions
  },
  paddingX: {
    type: 'select',
    label: 'Padding X',
    options: spacingOptions
  },
  paddingY: {
    type: 'select',
    label: 'Padding Y',
    options: spacingOptions
  },
  borderRadius: {
    type: 'select',
    label: 'Border radius',
    options: borderRadiusOptions
  },
  borderWidth: {
    type: 'select',
    label: 'Border width',
    options: borderWidthOptions
  },
  boxShadow: {
    type: 'select',
    label: 'Shadow',
    options: shadowOptions
  },
  opacity: {
    type: 'select',
    label: 'Opacity',
    options: [
      { label: '100%', value: '1' },
      { label: '90%', value: '0.9' },
      { label: '80%', value: '0.8' },
      { label: '70%', value: '0.7' },
      { label: '60%', value: '0.6' }
    ]
  }
} satisfies Record<string, Field>;

const colorFields = {
  textColor: createColorPickerField({ label: 'Text color', placeholder: 'e.g. #111827', fieldKey: 'textColor' }),
  backgroundColor: createColorPickerField({ label: 'Background color', placeholder: 'e.g. #F9E7B2', fieldKey: 'backgroundColor' }),
  borderColor: createColorPickerField({ label: 'Border color', placeholder: 'e.g. rgba(0,0,0,0.08)', fieldKey: 'borderColor' })
};

const sharedStyleFields = {
  ...baseStyleFields,
  ...colorFields
};

type SharedFields = typeof sharedStyleFields & {
  customAttributes: ReturnType<typeof createCustomAttributesField>;
};

const sharedFields: SharedFields = {
  ...sharedStyleFields,
  customAttributes: createCustomAttributesField()
};

export type StyleFieldKey = keyof typeof sharedStyleFields;
export type StyleFieldValues = Partial<Record<StyleFieldKey, string>>;

export type StyleableProps<T extends Record<string, unknown>> = T & StyleFieldValues & {
  customAttributes?: CustomAttributeList;
};

export const STYLE_FIELD_KEYS = Object.keys(sharedStyleFields) as StyleFieldKey[];

export const withStyleFields = <T extends Record<string, Field>>(fields: T): T & SharedFields => ({
  ...fields,
  ...sharedFields
});

export const splitStyleProps = <Props extends Record<string, unknown>>(props: Props) => {
  const styleProps: StyleFieldValues = {};
  const rest: Record<string, unknown> = {};

  Object.entries(props ?? {}).forEach(([key, value]) => {
    if (STYLE_FIELD_KEYS.includes(key as StyleFieldKey)) {
      if (value !== undefined) {
        styleProps[key as StyleFieldKey] = value as string;
      }
      return;
    }
    rest[key] = value;
  });

  return {
    styleProps,
    rest: rest as Omit<Props, StyleFieldKey>
  };
};

export const createInlineStyle = (styleProps: StyleFieldValues): CSSProperties => {
  const style: CSSProperties = {};
  const assign = <Key extends keyof CSSProperties>(key: Key, value?: CSSProperties[Key]) => {
    if (value === undefined || value === '') {
      return;
    }
    style[key] = value;
  };

  const applyAxis = (value: string | undefined, keys: Array<keyof CSSProperties>) => {
    if (!value) {
      return;
    }
    keys.forEach((key) => {
      style[key] = value as never;
    });
  };

  assign('display', styleProps.layoutDisplay as CSSProperties['display']);
  assign('flexDirection', styleProps.layoutDirection as CSSProperties['flexDirection']);
  assign('flexWrap', styleProps.layoutWrap as CSSProperties['flexWrap']);
  assign('justifyContent', styleProps.justifyContent as CSSProperties['justifyContent']);
  assign('alignItems', styleProps.alignItems as CSSProperties['alignItems']);
  assign('gap', styleProps.gap);
  assign('position', styleProps.position as CSSProperties['position']);
  assign('textAlign', styleProps.textAlign as CSSProperties['textAlign']);
  assign('fontSize', styleProps.fontSize as CSSProperties['fontSize']);
  assign('fontWeight', styleProps.fontWeight as CSSProperties['fontWeight']);
  assign('lineHeight', styleProps.lineHeight as CSSProperties['lineHeight']);
  assign('color', styleProps.textColor);
  assign('backgroundColor', styleProps.backgroundColor);
  assign('width', styleProps.width);
  assign('maxWidth', styleProps.maxWidth);
  assign('minHeight', styleProps.minHeight);
  assign('margin', styleProps.margin);
  assign('padding', styleProps.padding);
  assign('borderRadius', styleProps.borderRadius);
  assign('borderWidth', styleProps.borderWidth);
  assign('borderColor', styleProps.borderColor);
  assign('boxShadow', styleProps.boxShadow);
  assign('opacity', styleProps.opacity as CSSProperties['opacity']);

  if (styleProps.borderWidth && !style.borderStyle) {
    style.borderStyle = 'solid';
  }

  applyAxis(styleProps.marginX, ['marginLeft', 'marginRight']);
  applyAxis(styleProps.marginY, ['marginTop', 'marginBottom']);
  applyAxis(styleProps.paddingX, ['paddingLeft', 'paddingRight']);
  applyAxis(styleProps.paddingY, ['paddingTop', 'paddingBottom']);

  return style;
};

const sanitizeAttributeName = (name?: string) => name?.trim() ?? '';

/**
 * Convert user-provided custom attributes into a safe prop map for DOM nodes.
 */
export const buildAttributeProps = (customAttributes?: CustomAttributeList): Record<string, string> => {
  if (!customAttributes?.length) {
    return {};
  }
  return customAttributes.reduce<Record<string, string>>((acc, attribute, index) => {
    const cleanedName = sanitizeAttributeName(attribute.name);
    if (!cleanedName) {
      logStyleControlEvent('Skipped empty custom attribute', { attributeIndex: index, attributeId: attribute.id });
      return acc;
    }
    if (!ATTRIBUTE_NAME_PATTERN.test(cleanedName)) {
      logStyleControlEvent('Skipped invalid custom attribute name', {
        attributeIndex: index,
        attributeId: attribute.id,
        name: cleanedName
      });
      return acc;
    }
    acc[cleanedName] = attribute.value ?? '';
    logStyleControlEvent('Applied custom attribute', { name: cleanedName });
    return acc;
  }, {});
};

type ColorPickerFieldControlProps = FieldProps<CustomField<string>, string> & {
  placeholder?: string;
  fieldKey: string;
};

const ColorPickerFieldControl = ({ id, field, onChange, readOnly, value, placeholder, fieldKey }: ColorPickerFieldControlProps) => {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const colorInputId = `${resolvedId}-color`;
  const textInputId = `${resolvedId}-text`;
  const colorPickerValue = deriveColorPickerValue(value);

  const emitChange = (next: string) => {
    if (readOnly) {
      return;
    }
    onChange(next);
  };

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Color picker used', { fieldKey, value: next });
    emitChange(next);
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Color text updated', { fieldKey, value: next });
    emitChange(next);
  };

  const handleReset = () => {
    logStyleControlEvent('Color reset requested', { fieldKey });
    emitChange('');
  };

  return (
    <div className="space-y-2">
      <label htmlFor={textInputId} className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
        {field.label ?? 'Color'}
        {value && !readOnly ? (
          <button type="button" onClick={handleReset} className="text-[0.65rem] font-semibold text-bw-amber">
            Reset
          </button>
        ) : null}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={colorInputId}
          type="color"
          className="h-9 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0 disabled:cursor-not-allowed"
          aria-label={`${field.label ?? 'Color'} picker`}
          value={colorPickerValue}
          onChange={handleColorChange}
          disabled={readOnly}
        />
        <input
          id={textInputId}
          type="text"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-bw-amber focus:outline-none"
          value={value ?? ''}
          onChange={handleTextChange}
          placeholder={placeholder}
          disabled={readOnly}
        />
      </div>
    </div>
  );
};

type CustomAttributesFieldControlProps = FieldProps<CustomField<CustomAttributeList>, CustomAttributeList>;

const CustomAttributesFieldControl = ({ id, value, onChange, readOnly }: CustomAttributesFieldControlProps) => {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const attributes = Array.isArray(value) ? value : [];

  const updateAttributes = (next: CustomAttributeList, message: string, details?: Record<string, unknown>) => {
    logStyleControlEvent(message, details);
    onChange(next);
  };

  const handleAdd = () => {
    if (readOnly) {
      return;
    }
    const nextAttribute: CustomAttribute = { id: safeRandomId(), name: '', value: '' };
    updateAttributes([...attributes, nextAttribute], 'Custom attribute added', { attributeId: nextAttribute.id });
  };

  const handleRemove = (attributeId: string) => {
    if (readOnly) {
      return;
    }
    updateAttributes(
      attributes.filter((attribute) => attribute.id !== attributeId),
      'Custom attribute removed',
      { attributeId }
    );
  };

  const handleUpdate = (attributeId: string, patch: Partial<CustomAttribute>) => {
    if (readOnly) {
      return;
    }
    const next = attributes.map((attribute) => (attribute.id === attributeId ? { ...attribute, ...patch } : attribute));
    updateAttributes(next, 'Custom attribute updated', { attributeId, fields: Object.keys(patch) });
  };

  return (
    <div className="space-y-3" aria-labelledby={`${resolvedId}-label`}>
      <div className="flex items-center justify-between">
        <p id={`${resolvedId}-label`} className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
          Custom attributes
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={readOnly}
        >
          Add attribute
        </button>
      </div>
      {attributes.length === 0 ? (
        <p className="text-xs text-gray-500">Add aria- or data- attributes that will be forwarded to the rendered element.</p>
      ) : (
        <div className="space-y-2">
          {attributes.map((attribute) => (
            <div key={attribute.id} className="rounded-lg border border-gray-200 bg-white/60 p-3">
              <div className="flex flex-col gap-2">
                <label className="text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">
                  Attribute name
                  <input
                    type="text"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
                    value={attribute.name ?? ''}
                    placeholder="e.g. data-testid"
                    onChange={(event) => handleUpdate(attribute.id, { name: event.target.value })}
                    disabled={readOnly}
                  />
                </label>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">
                  Value
                  <input
                    type="text"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
                    value={attribute.value ?? ''}
                    placeholder="e.g. hero-section"
                    onChange={(event) => handleUpdate(attribute.id, { value: event.target.value })}
                    disabled={readOnly}
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handleRemove(attribute.id)}
                    disabled={readOnly}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

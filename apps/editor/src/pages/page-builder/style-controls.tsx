import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import type { CustomField, Field, FieldProps } from '@measured/puck';
import type { BindingOption, DynamicBindingValue } from './dynamic-binding';
import { isDynamicBindingValue } from './dynamic-binding';
import { DynamicFieldControl, createDynamicSelectField, type StaticControlRendererProps } from './dynamic-field-control';

const STYLE_LOG_PREFIX = '[PageBuilder:StyleControls]';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const DEFAULT_COLOR_FALLBACK = '#111827';

type ColorPickerFieldConfig = {
  label: string;
  placeholder?: string;
  fieldKey: string;
};

type PresetOrCustomFieldConfig = {
  label: string;
  fieldKey: string;
  presetOptions: ReadonlyArray<{ label: string; value: string }>;
  placeholder?: string;
};

type CustomCssFieldConfig = {
  label: string;
  placeholder?: string;
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

const createColorPickerField = ({ label, placeholder, fieldKey }: ColorPickerFieldConfig, bindingOptions: BindingOption[]): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <ColorPickerFieldControl
      {...props}
      placeholder={placeholder}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
    />
  )
});

const createCustomAttributesField = (): Field<CustomAttributeList> => ({
  type: 'custom',
  label: 'Custom attributes',
  render: (props) => <CustomAttributesFieldControl {...props} />
});

const createPresetOrCustomField = (
  { label, fieldKey, presetOptions, placeholder }: PresetOrCustomFieldConfig,
  bindingOptions: BindingOption[]
): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <PresetOrCustomFieldControl
      {...props}
      fieldKey={fieldKey}
      presetOptions={presetOptions}
      placeholder={placeholder}
      bindingOptions={bindingOptions}
    />
  )
});

const createCustomCssField = ({ label, placeholder }: CustomCssFieldConfig, bindingOptions: BindingOption[]): Field => ({
  type: 'custom',
  label,
  render: (props) => <CustomCssFieldControl {...props} placeholder={placeholder} bindingOptions={bindingOptions} />
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

const createBaseStyleFields = (bindingOptions: BindingOption[]) => ({
  layoutDisplay: createDynamicSelectField({
    fieldKey: 'layoutDisplay',
    bindingOptions,
    label: 'Layout / Display',
    options: [
      { label: 'Inherit', value: '' },
      { label: 'Block', value: 'block' },
      { label: 'Flex', value: 'flex' },
      { label: 'Inline flex', value: 'inline-flex' },
      { label: 'Grid', value: 'grid' }
    ]
  }),
  layoutDirection: createDynamicSelectField({
    fieldKey: 'layoutDirection',
    bindingOptions,
    label: 'Layout / Direction',
    options: [
      { label: 'Row', value: 'row' },
      { label: 'Row reverse', value: 'row-reverse' },
      { label: 'Column', value: 'column' },
      { label: 'Column reverse', value: 'column-reverse' }
    ]
  }),
  layoutWrap: createDynamicSelectField({
    fieldKey: 'layoutWrap',
    bindingOptions,
    label: 'Layout / Wrap',
    options: [
      { label: 'No wrap', value: 'nowrap' },
      { label: 'Wrap', value: 'wrap' }
    ]
  }),
  justifyContent: createDynamicSelectField({
    fieldKey: 'justifyContent',
    bindingOptions,
    label: 'Layout / Justify',
    options: [
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' },
      { label: 'Space between', value: 'space-between' },
      { label: 'Space around', value: 'space-around' },
      { label: 'Space evenly', value: 'space-evenly' }
    ]
  }),
  alignItems: createDynamicSelectField({
    fieldKey: 'alignItems',
    bindingOptions,
    label: 'Layout / Align',
    options: [
      { label: 'Stretch', value: 'stretch' },
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' }
    ]
  }),
  gap: createPresetOrCustomField({
    label: 'Layout / Gap',
    fieldKey: 'gap',
    presetOptions: spacingOptions,
    placeholder: 'e.g. 24px or 1.5rem'
  }, bindingOptions),
  position: createDynamicSelectField({
    fieldKey: 'position',
    bindingOptions,
    label: 'Position',
    options: [
      { label: 'Static', value: 'static' },
      { label: 'Relative', value: 'relative' },
      { label: 'Absolute', value: 'absolute' }
    ]
  }),
  textAlign: createDynamicSelectField({
    fieldKey: 'textAlign',
    bindingOptions,
    label: 'Text align',
    options: [
      { label: 'Inherit', value: '' },
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
      { label: 'Justify', value: 'justify' }
    ]
  }),
  fontSize: createPresetOrCustomField({
    label: 'Font size',
    fieldKey: 'fontSize',
    presetOptions: fontSizeOptions,
    placeholder: 'e.g. 2.4rem'
  }, bindingOptions),
  fontWeight: createDynamicSelectField({
    fieldKey: 'fontWeight',
    bindingOptions,
    label: 'Font weight',
    options: fontWeightOptions
  }),
  lineHeight: createDynamicSelectField({
    fieldKey: 'lineHeight',
    bindingOptions,
    label: 'Line height',
    options: [
      { label: 'Inherit', value: '' },
      { label: 'Tight (1.1)', value: '1.1' },
      { label: 'Snug (1.3)', value: '1.3' },
      { label: 'Relaxed (1.6)', value: '1.6' }
    ]
  }),
  width: createPresetOrCustomField({
    label: 'Width',
    fieldKey: 'width',
    presetOptions: widthOptions,
    placeholder: 'e.g. 960px or 80%'
  }, bindingOptions),
  maxWidth: createPresetOrCustomField({
    label: 'Max width',
    fieldKey: 'maxWidth',
    presetOptions: widthOptions,
    placeholder: 'e.g. 1200px'
  }, bindingOptions),
  minHeight: createPresetOrCustomField({
    label: 'Min height',
    fieldKey: 'minHeight',
    presetOptions: minHeightOptions,
    placeholder: 'e.g. 75vh or 640px'
  }, bindingOptions),
  margin: createPresetOrCustomField({
    label: 'Margin (all)',
    fieldKey: 'margin',
    presetOptions: spacingOptions,
    placeholder: 'e.g. 32px'
  }, bindingOptions),
  marginX: createPresetOrCustomField({
    label: 'Margin X',
    fieldKey: 'marginX',
    presetOptions: spacingOptions,
    placeholder: 'e.g. auto'
  }, bindingOptions),
  marginY: createPresetOrCustomField({
    label: 'Margin Y',
    fieldKey: 'marginY',
    presetOptions: spacingOptions,
    placeholder: 'e.g. 48px'
  }, bindingOptions),
  padding: createPresetOrCustomField({
    label: 'Padding (all)',
    fieldKey: 'padding',
    presetOptions: spacingOptions,
    placeholder: 'e.g. 64px'
  }, bindingOptions),
  paddingX: createPresetOrCustomField({
    label: 'Padding X',
    fieldKey: 'paddingX',
    presetOptions: spacingOptions,
    placeholder: 'e.g. 5%'
  }, bindingOptions),
  paddingY: createPresetOrCustomField({
    label: 'Padding Y',
    fieldKey: 'paddingY',
    presetOptions: spacingOptions,
    placeholder: 'e.g. 80px'
  }, bindingOptions),
  borderRadius: createPresetOrCustomField({
    label: 'Border radius',
    fieldKey: 'borderRadius',
    presetOptions: borderRadiusOptions,
    placeholder: 'e.g. 24px'
  }, bindingOptions),
  borderWidth: createPresetOrCustomField({
    label: 'Border width',
    fieldKey: 'borderWidth',
    presetOptions: borderWidthOptions,
    placeholder: 'e.g. 3px'
  }, bindingOptions),
  boxShadow: createDynamicSelectField({
    fieldKey: 'boxShadow',
    bindingOptions,
    label: 'Shadow',
    options: shadowOptions
  }),
  opacity: createDynamicSelectField({
    fieldKey: 'opacity',
    bindingOptions,
    label: 'Opacity',
    options: [
      { label: '100%', value: '1' },
      { label: '90%', value: '0.9' },
      { label: '80%', value: '0.8' },
      { label: '70%', value: '0.7' },
      { label: '60%', value: '0.6' }
    ]
  })
}) satisfies Record<string, Field>;

const createColorFields = (bindingOptions: BindingOption[]) => ({
  textColor: createColorPickerField({ label: 'Text color', placeholder: 'e.g. #111827', fieldKey: 'textColor' }, bindingOptions),
  backgroundColor: createColorPickerField({ label: 'Background color', placeholder: 'e.g. #F9E7B2', fieldKey: 'backgroundColor' }, bindingOptions),
  borderColor: createColorPickerField({ label: 'Border color', placeholder: 'e.g. rgba(0,0,0,0.08)', fieldKey: 'borderColor' }, bindingOptions)
});

const createSharedStyleFields = (bindingOptions: BindingOption[]) => ({
  ...createBaseStyleFields(bindingOptions),
  ...createColorFields(bindingOptions)
});

type SharedStyleFields = ReturnType<typeof createSharedStyleFields>;

type SharedFields = SharedStyleFields & {
  customAttributes: ReturnType<typeof createCustomAttributesField>;
  customCss: ReturnType<typeof createCustomCssField>;
};

const createSharedFields = (bindingOptions: BindingOption[]): SharedFields => ({
  ...createSharedStyleFields(bindingOptions),
  customAttributes: createCustomAttributesField(),
  customCss: createCustomCssField({ label: 'Custom CSS', placeholder: 'e.g. color: #000; margin-top: 2rem;' }, bindingOptions)
});

export type StyleFieldKey = keyof SharedStyleFields;
export type StyleFieldValues = Partial<Record<StyleFieldKey, DynamicBindingValue>>;

export type StyleableProps<T extends Record<string, unknown>> = T & StyleFieldValues & {
  id?: string;
  customAttributes?: CustomAttributeList;
  customCss?: string;
};

export const STYLE_FIELD_KEYS = Object.keys(createSharedStyleFields([])) as StyleFieldKey[];

export const withStyleFields = <T extends Record<string, Field>>(fields: T, bindingOptions: BindingOption[]): T & SharedFields => ({
  ...fields,
  ...createSharedFields(bindingOptions)
});

export const splitStyleProps = <Props extends Record<string, unknown>>(props: Props) => {
  const styleProps: StyleFieldValues = {};
  const rest: Record<string, unknown> = {};

  Object.entries(props ?? {}).forEach(([key, value]) => {
    if (STYLE_FIELD_KEYS.includes(key as StyleFieldKey)) {
      if (value !== undefined) {
        styleProps[key as StyleFieldKey] = value as DynamicBindingValue;
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

export const createInlineStyle = (
  styleProps: StyleFieldValues,
  resolveDynamic?: (value: DynamicBindingValue | undefined, key: StyleFieldKey) => string
): CSSProperties => {
  const style: CSSProperties = {};
  const assign = <Key extends keyof CSSProperties>(key: Key, value?: CSSProperties[Key]) => {
    if (value === undefined || value === '') {
      return;
    }
    style[key] = value;
  };

  const read = (key: StyleFieldKey): string => {
    const raw = styleProps[key];
    if (resolveDynamic) {
      return resolveDynamic(raw, key);
    }
    if (isDynamicBindingValue(raw)) {
      return raw.fallback ?? '';
    }
    return typeof raw === 'string' ? raw : '';
  };

  const applyAxis = (value: string | undefined, keys: Array<keyof CSSProperties>) => {
    if (!value) {
      return;
    }
    keys.forEach((key) => {
      style[key] = value as never;
    });
  };

  assign('display', read('layoutDisplay') as CSSProperties['display']);
  assign('flexDirection', read('layoutDirection') as CSSProperties['flexDirection']);
  assign('flexWrap', read('layoutWrap') as CSSProperties['flexWrap']);
  assign('justifyContent', read('justifyContent') as CSSProperties['justifyContent']);
  assign('alignItems', read('alignItems') as CSSProperties['alignItems']);
  assign('gap', read('gap'));
  assign('position', read('position') as CSSProperties['position']);
  assign('textAlign', read('textAlign') as CSSProperties['textAlign']);
  assign('fontSize', read('fontSize') as CSSProperties['fontSize']);
  assign('fontWeight', read('fontWeight') as CSSProperties['fontWeight']);
  assign('lineHeight', read('lineHeight') as CSSProperties['lineHeight']);
  assign('color', read('textColor'));
  assign('backgroundColor', read('backgroundColor'));
  assign('width', read('width'));
  assign('maxWidth', read('maxWidth'));
  assign('minHeight', read('minHeight'));
  assign('margin', read('margin'));
  assign('padding', read('padding'));
  assign('borderRadius', read('borderRadius'));
  const borderWidthValue = read('borderWidth');
  assign('borderWidth', borderWidthValue);
  assign('borderColor', read('borderColor'));
  assign('boxShadow', read('boxShadow'));
  assign('opacity', read('opacity') as CSSProperties['opacity']);

  if (borderWidthValue && !style.borderStyle) {
    style.borderStyle = 'solid';
  }

  applyAxis(read('marginX'), ['marginLeft', 'marginRight']);
  applyAxis(read('marginY'), ['marginTop', 'marginBottom']);
  applyAxis(read('paddingX'), ['paddingLeft', 'paddingRight']);
  applyAxis(read('paddingY'), ['paddingTop', 'paddingBottom']);

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

const CUSTOM_OPTION_VALUE = '__custom__';

type PresetOrCustomFieldControlProps = FieldProps<CustomField<DynamicBindingValue>, DynamicBindingValue> & {
  presetOptions: ReadonlyArray<{ label: string; value: string }>;
  placeholder?: string;
  fieldKey: string;
  bindingOptions: BindingOption[];
};

const PresetOrCustomStaticControl = ({
  inputId,
  value,
  readOnly,
  placeholder,
  onChange,
  presetOptions,
  fieldKey
}: StaticControlRendererProps & {
  presetOptions: ReadonlyArray<{ label: string; value: string }>;
  fieldKey: string;
}) => {
  const selectId = `${inputId}-preset`;
  const customInputId = `${inputId}-custom`;
  const normalizedValue = value ?? '';
  const hasPresetMatch = presetOptions.some((option) => option.value === normalizedValue);
  const [mode, setMode] = useState<'preset' | 'custom'>(() => (hasPresetMatch ? 'preset' : 'custom'));
  const previousValueRef = useRef(normalizedValue);

  useEffect(() => {
    if (previousValueRef.current !== normalizedValue) {
      previousValueRef.current = normalizedValue;
      setMode(hasPresetMatch ? 'preset' : 'custom');
      return;
    }
    if (!hasPresetMatch && mode !== 'custom') {
      setMode('custom');
    }
  }, [hasPresetMatch, normalizedValue, mode]);

  const selectValue = mode === 'custom' ? CUSTOM_OPTION_VALUE : normalizedValue;
  const showCustomInput = mode === 'custom';

  const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (next === CUSTOM_OPTION_VALUE) {
      logStyleControlEvent('Preset switched to custom entry', { fieldKey });
      setMode('custom');
      return;
    }
    logStyleControlEvent('Preset value selected', { fieldKey, value: next });
    setMode('preset');
    onChange(next);
  };

  const handleCustomChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Custom value updated', { fieldKey, value: next });
    setMode('custom');
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <select
        id={selectId}
        aria-label="Preset options"
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed"
        value={selectValue}
        onChange={handlePresetChange}
        disabled={readOnly}
      >
        <option value={CUSTOM_OPTION_VALUE}>Custom value</option>
        {presetOptions.map((option) => (
          <option key={option.value ?? option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {showCustomInput ? (
        <input
          id={customInputId}
          aria-label="Custom value"
          type="text"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed"
          value={normalizedValue}
          onChange={handleCustomChange}
          placeholder={placeholder}
          disabled={readOnly}
        />
      ) : null}
    </div>
  );
};

const PresetOrCustomFieldControl = ({ fieldKey, bindingOptions, presetOptions, placeholder, ...rest }: PresetOrCustomFieldControlProps) => (
  <DynamicFieldControl
    {...rest}
    fieldKey={fieldKey}
    bindingOptions={bindingOptions}
    placeholder={placeholder}
    renderStaticControl={(controlProps) => (
      <PresetOrCustomStaticControl
        {...controlProps}
        presetOptions={presetOptions}
        placeholder={placeholder}
        fieldKey={fieldKey}
      />
    )}
  />
);

type ColorPickerFieldControlProps = FieldProps<CustomField<DynamicBindingValue>, DynamicBindingValue> & {
  placeholder?: string;
  fieldKey: string;
  bindingOptions: BindingOption[];
};

type CustomCssFieldControlProps = FieldProps<CustomField<DynamicBindingValue>, DynamicBindingValue> & {
  placeholder?: string;
  bindingOptions: BindingOption[];
};

const CustomCssStaticControl = ({
  inputId,
  value,
  onChange,
  readOnly,
  placeholder
}: StaticControlRendererProps & { placeholder?: string }) => (
  <div className="space-y-2">
    <textarea
      id={inputId}
      className="h-28 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed"
      value={value ?? ''}
      onChange={(event) => {
        const next = event.target.value;
        logStyleControlEvent('Custom CSS updated', { fieldKey: 'customCss', length: next.length });
        onChange(next);
      }}
      placeholder={placeholder ?? 'color: #000;\npadding: 12px;'}
      disabled={readOnly}
    />
    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-400">Scoped to this component</p>
  </div>
);

const CustomCssFieldControl = ({ bindingOptions, placeholder, ...rest }: CustomCssFieldControlProps) => (
  <DynamicFieldControl
    {...rest}
    fieldKey="customCss"
    bindingOptions={bindingOptions}
    placeholder={placeholder}
    renderStaticControl={(controlProps) => (
      <CustomCssStaticControl {...controlProps} placeholder={placeholder} />
    )}
  />
);

const ColorPickerStaticControl = ({
  inputId,
  value,
  onChange,
  readOnly,
  placeholder,
  fieldKey
}: StaticControlRendererProps & { placeholder?: string; fieldKey: string }) => {
  const colorInputId = `${inputId}-color`;
  const textInputId = `${inputId}-text`;
  const colorPickerValue = deriveColorPickerValue(value);

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Color picker used', { fieldKey, value: next });
    onChange(next);
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Color text updated', { fieldKey, value: next });
    onChange(next);
  };

  const handleReset = () => {
    logStyleControlEvent('Color reset requested', { fieldKey });
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          id={colorInputId}
          type="color"
          className="h-9 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0 disabled:cursor-not-allowed"
          aria-label="Color picker"
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
        {value && !readOnly ? (
          <button type="button" onClick={handleReset} className="text-xs font-semibold text-bw-amber">
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ColorPickerFieldControl = ({ fieldKey, bindingOptions, placeholder, ...rest }: ColorPickerFieldControlProps) => (
  <DynamicFieldControl
    {...rest}
    fieldKey={fieldKey}
    bindingOptions={bindingOptions}
    placeholder={placeholder}
    renderStaticControl={(controlProps) => (
      <ColorPickerStaticControl
        {...controlProps}
        placeholder={placeholder}
        fieldKey={fieldKey}
      />
    )}
  />
);

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

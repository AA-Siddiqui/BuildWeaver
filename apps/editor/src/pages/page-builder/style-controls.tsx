import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import type { CustomField, Field, FieldProps } from '@measured/puck';
import type { BindingOption, DynamicBindingValue } from './dynamic-binding';
import { isDynamicBindingValue } from './dynamic-binding';
import {
  DynamicFieldControl,
  createDynamicBooleanField,
  createDynamicSelectField,
  type StaticControlRendererProps
} from './dynamic-field-control';
import { PropertyFilterGuard, PropertySearchFieldControl, PROPERTY_SEARCH_FIELD_KEY } from './property-search';
import { ComponentActionsField } from './component-actions-field';
import { COMPONENT_ACTIONS_FIELD_KEY } from './component-library';

const STYLE_LOG_PREFIX = '[PageBuilder:StyleControls]';
const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const DEFAULT_COLOR_FALLBACK = '#111827';
const GRADIENT_PREFIXES = ['linear-gradient', 'radial-gradient'] as const;
const MIN_GRADIENT_STOPS = 2;
const ZERO_ALPHA_EPSILON = 0.001;
const HEX_SHORT_PATTERN = /^#[0-9a-fA-F]{3}$/;
const HEX_LONG_PATTERN = /^#[0-9a-fA-F]{6}$/;
const HEX_WITH_ALPHA_PATTERN = /^#[0-9a-fA-F]{8}$/;
const RGB_FUNCTION_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

type NormalizedColor = {
  hex: string;
  alpha: number;
};

export type GradientType = (typeof GRADIENT_PREFIXES)[number] extends `${infer Prefix}-gradient` ? Prefix : never;
export type GradientStop = {
  id: string;
  color: string;
  position: number; // 0 - 1 inclusive
};
export type GradientConfig = {
  type: GradientType;
  angle: number;
  stops: GradientStop[];
};

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

export const logStyleControlEvent = (message: string, details?: Record<string, unknown>) => {
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

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const clampChannel = (value: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 255);
};

const clampAlpha = (value: number) => clamp(value, 0, 1);
const clampAngle = (value: number) => clamp(value, 0, 360);
const clampStopPosition = (value: number) => clamp(value, 0, 1);

const expandShortHex = (value: string) => `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;

const normalizeHex = (value: string) => {
  if (HEX_SHORT_PATTERN.test(value)) {
    return expandShortHex(value).toLowerCase();
  }
  if (HEX_LONG_PATTERN.test(value)) {
    return value.toLowerCase();
  }
  return value.toLowerCase();
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}` as const;

const parseHexColor = (value: string): NormalizedColor | null => {
  if (HEX_SHORT_PATTERN.test(value) || HEX_LONG_PATTERN.test(value)) {
    return { hex: normalizeHex(value), alpha: 1 };
  }
  if (HEX_WITH_ALPHA_PATTERN.test(value)) {
    const normalized = value.toLowerCase();
    const hex = normalizeHex(`#${normalized.slice(1, 7)}`);
    const alpha = clampAlpha(parseInt(normalized.slice(7, 9), 16) / 255);
    return { hex, alpha };
  }
  return null;
};

const parseRgbFunction = (value: string): NormalizedColor | null => {
  const match = value.match(RGB_FUNCTION_PATTERN);
  if (!match) {
    return null;
  }
  const [, rString, gString, bString, alphaString] = match;
  const r = clampChannel(parseInt(rString ?? '0', 10));
  const g = clampChannel(parseInt(gString ?? '0', 10));
  const b = clampChannel(parseInt(bString ?? '0', 10));
  const alpha = alphaString === undefined ? 1 : clampAlpha(parseFloat(alphaString));
  return {
    hex: rgbToHex(r, g, b),
    alpha
  };
};

const parseSolidColor = (value?: string): NormalizedColor | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return parseHexColor(trimmed) ?? parseRgbFunction(trimmed);
};

const formatColorWithAlpha = (hex: string, alpha: number) => {
  const normalizedHex = normalizeHex(hex);
  const normalizedAlpha = clampAlpha(alpha);
  if (normalizedAlpha >= 1) {
    return normalizedHex;
  }
  const { r, g, b } = hexToRgb(normalizedHex);
  const roundedAlpha = Math.round(normalizedAlpha * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`;
};

const resolveColorValue = (value?: string, fallback = DEFAULT_COLOR_FALLBACK) => {
  const parsed = parseSolidColor(value) ?? parseSolidColor(fallback);
  if (!parsed) {
    return DEFAULT_COLOR_FALLBACK;
  }
  return formatColorWithAlpha(parsed.hex, parsed.alpha);
};

const readColorAlpha = (value?: string) => parseSolidColor(value)?.alpha ?? 1;

const toRenderableColor = (value?: string, options?: { fieldKey?: string; log?: boolean }): string => {
  if (!value) {
    return '';
  }
  const parsed = parseSolidColor(value);
  if (!parsed) {
    return value;
  }
  if (parsed.alpha <= ZERO_ALPHA_EPSILON) {
    if (options?.log) {
      logStyleControlEvent('Collapsed zero-alpha color to transparent', {
        fieldKey: options.fieldKey,
        source: value
      });
    }
    return 'transparent';
  }
  if (parsed.alpha >= 1) {
    return parsed.hex;
  }
  return formatColorWithAlpha(parsed.hex, parsed.alpha);
};

const splitGradientArgs = (input: string): string[] => {
  const segments: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === ',' && depth === 0) {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = '';
      continue;
    }
    if (char === '(') {
      depth += 1;
    }
    if (char === ')' && depth > 0) {
      depth -= 1;
    }
    current += char;
  }
  if (current.trim()) {
    segments.push(current.trim());
  }
  return segments;
};

const normalizeStops = (stops: GradientStop[]): GradientStop[] => {
  const normalized = stops
    .map((stop) => ({
      ...stop,
      color: resolveColorValue(stop.color, DEFAULT_COLOR_FALLBACK),
      position: clampStopPosition(stop.position)
    }))
    .sort((a, b) => a.position - b.position);

  if (normalized.length >= MIN_GRADIENT_STOPS) {
    return normalized;
  }
  if (normalized.length === 1) {
    return [
      normalized[0],
      {
        id: safeRandomId(),
        color: normalized[0].color,
        position: normalized[0].position === 1 ? 0 : 1
      }
    ];
  }
  return [
    {
      id: safeRandomId(),
      color: DEFAULT_COLOR_FALLBACK,
      position: 0
    },
    {
      id: safeRandomId(),
      color: '#F9E7B2',
      position: 1
    }
  ];
};

export const normalizeGradientConfig = (config: GradientConfig): GradientConfig => ({
  type: config.type,
  angle: clampAngle(config.angle ?? 0),
  stops: normalizeStops(config.stops ?? [])
});

export const createDefaultGradientConfig = (seedColor?: string): GradientConfig =>
  normalizeGradientConfig({
    type: 'linear',
    angle: 90,
    stops: [
      { id: safeRandomId(), color: resolveColorValue(seedColor, DEFAULT_COLOR_FALLBACK), position: 0 },
      { id: safeRandomId(), color: '#F9E7B2', position: 1 }
    ]
  });

const formatStopPosition = (position: number) => {
  const percent = clampStopPosition(position) * 100;
  return percent % 1 === 0 ? `${percent}%` : `${percent.toFixed(2)}%`;
};

const RGB_FUNCTION_STOP_SOURCE = 'rgba?\\(\\s*(?:\\d{1,3}\\s*,\\s*){2}\\d{1,3}(?:\\s*,\\s*(?:0|1|0?\\.\\d+))?\\s*\\)';
const GRADIENT_STOP_PATTERN = new RegExp(`(#[0-9a-fA-F]{3,8}|${RGB_FUNCTION_STOP_SOURCE})\\s+([0-9]*\\.?[0-9]+)%$`, 'i');

export const isGradientValue = (value?: string): boolean => {
  if (!value) {
    return false;
  }
  const trimmed = value.trim().toLowerCase();
  return GRADIENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
};

export const parseGradientValue = (value?: string): GradientConfig | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!isGradientValue(trimmed)) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  const [matchedPrefix] = GRADIENT_PREFIXES.filter((prefix) => lower.startsWith(prefix));
  if (!matchedPrefix) {
    return null;
  }
  const payload = trimmed.slice(matchedPrefix.length + 1, -1);
  const parts = splitGradientArgs(payload);
  if (parts.length < MIN_GRADIENT_STOPS + 1 && matchedPrefix === 'linear-gradient') {
    return null;
  }

  if (matchedPrefix === 'linear-gradient') {
    const anglePart = parts[0];
    const stops = parts.slice(1);
    const parsedAngle = parseFloat(anglePart.replace(/deg/i, ''));
    const parsedStops: GradientStop[] = stops
      .map((stop) => {
        const match = stop.match(GRADIENT_STOP_PATTERN);
        if (!match) {
          return null;
        }
        const parsedColor = parseSolidColor(match[1]);
        if (!parsedColor) {
          return null;
        }
        return {
          id: safeRandomId(),
          color: formatColorWithAlpha(parsedColor.hex, parsedColor.alpha),
          position: clampStopPosition(parseFloat(match[2]) / 100)
        };
      })
      .filter((stop): stop is GradientStop => Boolean(stop));
    if (!parsedStops.length) {
      return null;
    }
    return normalizeGradientConfig({
      type: 'linear',
      angle: parsedAngle,
      stops: parsedStops
    });
  }

  if (matchedPrefix === 'radial-gradient') {
    const stops = parts[0]?.toLowerCase().startsWith('circle') ? parts.slice(1) : parts;
    if (stops.length < MIN_GRADIENT_STOPS) {
      return null;
    }
    const parsedStops: GradientStop[] = stops
      .map((stop) => {
        const match = stop.match(GRADIENT_STOP_PATTERN);
        if (!match) {
          return null;
        }
        const parsedColor = parseSolidColor(match[1]);
        if (!parsedColor) {
          return null;
        }
        return {
          id: safeRandomId(),
          color: formatColorWithAlpha(parsedColor.hex, parsedColor.alpha),
          position: clampStopPosition(parseFloat(match[2]) / 100)
        };
      })
      .filter((stop): stop is GradientStop => Boolean(stop));
    if (!parsedStops.length) {
      return null;
    }
    return normalizeGradientConfig({
      type: 'radial',
      angle: 0,
      stops: parsedStops
    });
  }

  return null;
};

export const stringifyGradientConfig = (config: GradientConfig): string => {
  const normalized = normalizeGradientConfig(config);
  const stops = normalized.stops
    .map((stop) => `${stop.color} ${formatStopPosition(stop.position)}`)
    .join(', ');
  if (normalized.type === 'radial') {
    return `radial-gradient(circle, ${stops})`;
  }
  return `linear-gradient(${normalized.angle}deg, ${stops})`;
};

export const deriveColorPickerValue = (value?: string, fallback = DEFAULT_COLOR_FALLBACK) => {
  const parsed = parseSolidColor(value) ?? parseSolidColor(fallback);
  if (!parsed) {
    return DEFAULT_COLOR_FALLBACK;
  }
  return parsed.hex;
};

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

const createPropertySearchField = (): Field => ({
  type: 'custom',
  label: 'Search properties',
  render: (props) => <PropertySearchFieldControl {...props} />
});

const createCustomAttributesField = (): Field<CustomAttributeList> => ({
  type: 'custom',
  label: 'Custom attributes',
  render: (props) => (
    <PropertyFilterGuard fieldKey="customAttributes" label="Custom attributes">
      <CustomAttributesFieldControl {...props} />
    </PropertyFilterGuard>
  )
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

type PropertySearchFieldMap = {
  [PROPERTY_SEARCH_FIELD_KEY]: ReturnType<typeof createPropertySearchField>;
};

const createSharedFields = (bindingOptions: BindingOption[]): SharedStyleFields & {
  renderWhen: ReturnType<typeof createDynamicBooleanField>;
  customAttributes: ReturnType<typeof createCustomAttributesField>;
  customCss: ReturnType<typeof createCustomCssField>;
} => ({
  ...createSharedStyleFields(bindingOptions),
  renderWhen: createDynamicBooleanField({
    fieldKey: 'renderWhen',
    bindingOptions,
    label: 'Visibility',
    trueLabel: 'Render element',
    falseLabel: 'Hide element',
    helperText: 'Toggle or bind to hide/show this component.',
    defaultValue: true
  }),
  customAttributes: createCustomAttributesField(),
  customCss: createCustomCssField({ label: 'Custom CSS', placeholder: 'e.g. color: #000; margin-top: 2rem;' }, bindingOptions)
});

type SharedFields = ReturnType<typeof createSharedFields> & PropertySearchFieldMap;

export type StyleFieldKey = keyof SharedStyleFields;
export type StyleFieldValues = Partial<Record<StyleFieldKey, DynamicBindingValue>>;

const ZERO_SPACING = '0px' as const;
export const STYLELESS_TEXT_COLOR = '#000000';
export const STYLELESS_BACKGROUND_COLOR = '#FFFFFF';
const STYLELESS_BORDER_COLOR = '#000000';

export const STYLELESS_STYLE_DEFAULTS: StyleFieldValues = {
  layoutDisplay: '',
  layoutDirection: '',
  layoutWrap: '',
  justifyContent: '',
  alignItems: '',
  gap: ZERO_SPACING,
  position: '',
  textAlign: '',
  fontSize: '',
  fontWeight: '',
  lineHeight: '',
  width: '',
  maxWidth: '',
  minHeight: '',
  margin: ZERO_SPACING,
  marginX: ZERO_SPACING,
  marginY: ZERO_SPACING,
  padding: ZERO_SPACING,
  paddingX: ZERO_SPACING,
  paddingY: ZERO_SPACING,
  borderRadius: ZERO_SPACING,
  borderWidth: '',
  boxShadow: '',
  opacity: '1',
  textColor: STYLELESS_TEXT_COLOR,
  backgroundColor: STYLELESS_BACKGROUND_COLOR,
  borderColor: STYLELESS_BORDER_COLOR
};

export type RenderControlValue = DynamicBindingValue | string | boolean | null | undefined;

export type StyleableProps<T extends Record<string, unknown>> = T & StyleFieldValues & {
  id?: string;
  customAttributes?: CustomAttributeList;
  customCss?: string;
  renderWhen?: RenderControlValue;
};

export const STYLE_FIELD_KEYS = Object.keys(createSharedStyleFields([])) as StyleFieldKey[];

export const applyStylelessDefaults = <Props extends StyleableProps<Record<string, unknown>>>(
  componentName: string,
  props: Partial<Props>
): Partial<Props> => {
  const merged = {
    ...(STYLELESS_STYLE_DEFAULTS as Partial<Props>),
    ...(props ?? {})
  };
  const overriddenStyleKeys = Object.keys(props ?? {}).filter((key) => STYLE_FIELD_KEYS.includes(key as StyleFieldKey));
  logStyleControlEvent('Applied styleless defaults', {
    component: componentName,
    overriddenStyleKeys,
    totalStyleKeys: STYLE_FIELD_KEYS.length
  });
  return merged;
};

export const withStyleFields = <T extends Record<string, Field>>(fields: T, bindingOptions: BindingOption[]): T & SharedFields => ({
  [PROPERTY_SEARCH_FIELD_KEY]: createPropertySearchField(),
  [COMPONENT_ACTIONS_FIELD_KEY]: {
    type: 'custom',
    label: 'Component',
    render: (props) => <ComponentActionsField {...props} />
  },
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
  const textColor = read('textColor');
  assign('color', toRenderableColor(textColor, { fieldKey: 'textColor' }));
  const backgroundValue = read('backgroundColor');
  if (isGradientValue(backgroundValue)) {
    assign('backgroundImage', backgroundValue as CSSProperties['backgroundImage']);
  } else {
    assign('backgroundColor', toRenderableColor(backgroundValue, { fieldKey: 'backgroundColor', log: true }));
  }
  assign('width', read('width'));
  assign('maxWidth', read('maxWidth'));
  assign('minHeight', read('minHeight'));
  assign('margin', read('margin'));
  assign('padding', read('padding'));
  assign('borderRadius', read('borderRadius'));
  const borderWidthValue = read('borderWidth');
  assign('borderWidth', borderWidthValue);
  const borderColorValue = read('borderColor');
  if (isGradientValue(borderColorValue)) {
    assign('borderImageSlice', 1 as CSSProperties['borderImageSlice']);
    assign('borderImageSource', borderColorValue as CSSProperties['borderImageSource']);
  } else {
    assign('borderColor', toRenderableColor(borderColorValue, { fieldKey: 'borderColor', log: true }));
  }
  assign('boxShadow', read('boxShadow'));
  assign('opacity', read('opacity') as CSSProperties['opacity']);

  const hasVisibleBorderWidth = Boolean(
    borderWidthValue && !/^0(px)?$/i.test(borderWidthValue.trim())
  );

  if (hasVisibleBorderWidth && !style.borderStyle) {
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

type GradientBuilderProps = {
  config: GradientConfig;
  readOnly?: boolean;
  onConfigChange: (updater: (prev: GradientConfig) => GradientConfig) => void;
  onManualValueChange: (value: string) => void;
  currentValue: string;
  fieldKey: string;
};

const findNextStopPosition = (stops: GradientStop[]): number => {
  if (!stops.length) {
    return 0.5;
  }
  const ordered = [...stops].sort((a, b) => a.position - b.position);
  let largestGapMidpoint = 0.5;
  let largestGap = -1;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const gap = next.position - current.position;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapMidpoint = current.position + gap / 2;
    }
  }
  if (largestGap <= 0) {
    return clampStopPosition((ordered[0]?.position ?? 0) + 0.5);
  }
  return clampStopPosition(largestGapMidpoint);
};

const GradientBuilder = ({
  config,
  readOnly,
  onConfigChange,
  onManualValueChange,
  currentValue,
  fieldKey
}: GradientBuilderProps) => {
  const gradientValue = isGradientValue(currentValue) ? currentValue : stringifyGradientConfig(config);

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (readOnly) {
      return;
    }
    const nextType = event.target.value as GradientType;
    logStyleControlEvent('Gradient type changed', { fieldKey, type: nextType });
    onConfigChange((prev) => ({ ...prev, type: nextType }));
  };

  const handleAngleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      return;
    }
    const nextAngle = clampAngle(parseFloat(event.target.value));
    logStyleControlEvent('Gradient angle changed', { fieldKey, angle: nextAngle });
    onConfigChange((prev) => ({ ...prev, angle: nextAngle }));
  };

  const handleAddStop = () => {
    if (readOnly) {
      return;
    }
    const nextStop: GradientStop = {
      id: safeRandomId(),
      color: config.stops[config.stops.length - 1]?.color ?? DEFAULT_COLOR_FALLBACK,
      position: findNextStopPosition(config.stops)
    };
    logStyleControlEvent('Gradient stop added', { fieldKey, stopId: nextStop.id, position: nextStop.position });
    onConfigChange((prev) => ({ ...prev, stops: [...prev.stops, nextStop] }));
  };

  const handleRemoveStop = (stopId: string) => {
    if (readOnly) {
      return;
    }
    if (config.stops.length <= MIN_GRADIENT_STOPS) {
      logStyleControlEvent('Gradient stop removal blocked', { fieldKey, reason: 'min-stops' });
      return;
    }
    logStyleControlEvent('Gradient stop removed', { fieldKey, stopId });
    onConfigChange((prev) => ({ ...prev, stops: prev.stops.filter((stop) => stop.id !== stopId) }));
  };

  const handleStopColorChange = (stopId: string, nextColor: string) => {
    if (readOnly) {
      return;
    }
    const parsed = parseSolidColor(nextColor);
    if (!parsed) {
      logStyleControlEvent('Gradient stop color rejected', { fieldKey, stopId, value: nextColor });
      return;
    }
    const currentStop = config.stops.find((stop) => stop.id === stopId);
    const existingAlpha = readColorAlpha(currentStop?.color);
    const formatted = formatColorWithAlpha(parsed.hex, existingAlpha);
    logStyleControlEvent('Gradient stop color changed', { fieldKey, stopId, value: formatted, alpha: existingAlpha });
    onConfigChange((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => (stop.id === stopId ? { ...stop, color: formatted } : stop))
    }));
  };

  const handleStopAlphaChange = (stopId: string, nextAlphaPercent: number) => {
    if (readOnly) {
      return;
    }
    const normalizedAlpha = clampAlpha(nextAlphaPercent / 100);
    logStyleControlEvent('Gradient stop alpha changed', { fieldKey, stopId, alpha: normalizedAlpha });
    onConfigChange((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => {
        if (stop.id !== stopId) {
          return stop;
        }
        const baseHex = deriveColorPickerValue(stop.color);
        return { ...stop, color: formatColorWithAlpha(baseHex, normalizedAlpha) };
      })
    }));
  };

  const handleStopPositionChange = (stopId: string, nextPosition: number) => {
    if (readOnly) {
      return;
    }
    const clamped = clampStopPosition(nextPosition);
    logStyleControlEvent('Gradient stop position changed', { fieldKey, stopId, position: clamped });
    onConfigChange((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => (stop.id === stopId ? { ...stop, position: clamped } : stop))
    }));
  };

  const handleManualCssChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Gradient CSS manually edited', { fieldKey, length: next.length });
    onManualValueChange(next);
  };

  const orderedStops = [...config.stops].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-3">
      <div className="h-16 w-full rounded-lg border border-gray-200" style={{ backgroundImage: stringifyGradientConfig(config) }} />
      <div className="space-y-1">
        <label className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400" htmlFor={`${fieldKey}-gradient-type`}>
          Gradient type
        </label>
        <select
          id={`${fieldKey}-gradient-type`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed"
          value={config.type}
          onChange={handleTypeChange}
          disabled={readOnly}
        >
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </div>
      {config.type === 'linear' ? (
        <div className="space-y-1">
          <label className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400" htmlFor={`${fieldKey}-gradient-angle`}>
            Angle ({config.angle}°)
          </label>
          <div className="flex items-center gap-3">
            <input
              id={`${fieldKey}-gradient-angle`}
              type="range"
              min={0}
              max={360}
              step={1}
              className="flex-1"
              value={config.angle}
              onChange={handleAngleChange}
              aria-label="Gradient angle"
              disabled={readOnly}
            />
            <input
              type="number"
              min={0}
              max={360}
              step={1}
              className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-gray-900"
              value={config.angle}
              onChange={handleAngleChange}
              aria-label="Gradient angle numeric"
              disabled={readOnly}
            />
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">Color stops</p>
          <button
            type="button"
            onClick={handleAddStop}
            className="text-xs font-semibold text-bw-amber disabled:cursor-not-allowed disabled:opacity-60"
            disabled={readOnly}
          >
            Add stop
          </button>
        </div>
        <div className="space-y-2">
          {orderedStops.map((stop, index) => {
            const alphaPercent = Math.round(readColorAlpha(stop.color) * 100);
            const alphaInputId = `${fieldKey}-gradient-stop-${stop.id}-alpha`;
            return (
              <div key={stop.id} className="max-w-full min-w-full flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
                <div className="w-full flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  className="h-9 aspect-square cursor-pointer rounded border border-gray-300 bg-white p-0 disabled:cursor-not-allowed"
                  value={deriveColorPickerValue(stop.color)}
                  onChange={(event) => handleStopColorChange(stop.id, event.target.value)}
                  aria-label={`Color stop ${index + 1} color`}
                  disabled={readOnly}
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-900"
                  value={stop.position.toFixed(2)}
                  onChange={(event) => handleStopPositionChange(stop.id, parseFloat(event.target.value))}
                  aria-label={`Color stop ${index + 1} position`}
                  disabled={readOnly}
                />
                <button
                  type="button"
                  className="text-xs text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleRemoveStop(stop.id)}
                  disabled={readOnly || orderedStops.length <= MIN_GRADIENT_STOPS}
                >
                  Remove
                </button>
              </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={alphaInputId}
                    className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400"
                  >
                    Alpha stop {index + 1} ({alphaPercent}%)
                  </label>
                  <input
                    id={alphaInputId}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                    value={alphaPercent}
                    onChange={(event) => handleStopAlphaChange(stop.id, parseFloat(event.target.value))}
                    aria-label={`Alpha stop ${index + 1}`}
                    disabled={readOnly}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400" htmlFor={`${fieldKey}-gradient-css`}>
          Gradient CSS
        </label>
        <input
          id={`${fieldKey}-gradient-css`}
          type="text"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
          value={gradientValue}
          onChange={handleManualCssChange}
          disabled={readOnly}
        />
      </div>
    </div>
  );
};

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
  const modeSelectId = `${inputId}-mode`;
  const alphaInputId = `${inputId}-alpha`;
  const [colorMode, setColorMode] = useState<'solid' | 'gradient'>(() => (isGradientValue(value) ? 'gradient' : 'solid'));
  const [gradientConfig, setGradientConfig] = useState<GradientConfig>(() => {
    const parsedGradient = parseGradientValue(value);
    if (parsedGradient) {
      return parsedGradient;
    }
    const seedColor = parseSolidColor(value) ? value : undefined;
    return createDefaultGradientConfig(seedColor);
  });
  const colorPickerValue = deriveColorPickerValue(value);

  useEffect(() => {
    if (isGradientValue(value)) {
      setColorMode('gradient');
      const parsed = parseGradientValue(value);
      if (parsed) {
        setGradientConfig(parsed);
      }
      return;
    }
    setColorMode('solid');
  }, [value]);

  const updateGradientConfig = (updater: (prev: GradientConfig) => GradientConfig) => {
    setGradientConfig((prev) => {
      const nextConfig = normalizeGradientConfig(updater(prev));
      const cssValue = stringifyGradientConfig(nextConfig);
      logStyleControlEvent('Gradient updated', { fieldKey, value: cssValue });
      onChange(cssValue);
      return nextConfig;
    });
  };

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextHex = event.target.value;
    const currentAlpha = readColorAlpha(value);
    const formatted = formatColorWithAlpha(nextHex, currentAlpha);
    logStyleControlEvent('Color picker used', { fieldKey, value: formatted, alpha: currentAlpha });
    onChange(formatted);
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    logStyleControlEvent('Color text updated', { fieldKey, value: next });
    onChange(next);
  };

  const handleManualGradientInput = (next: string) => {
    logStyleControlEvent('Gradient manual input received', { fieldKey });
    onChange(next);
    const parsed = parseGradientValue(next);
    if (parsed) {
      setGradientConfig(parsed);
    }
  };

  const handleReset = () => {
    logStyleControlEvent('Color reset requested', { fieldKey });
    onChange('');
    setColorMode('solid');
  };

  const handleModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextMode = event.target.value as 'solid' | 'gradient';
    setColorMode(nextMode);
    if (nextMode === 'gradient') {
      let nextConfig = gradientConfig;
      const parsedSolid = parseSolidColor(value);
      if (parsedSolid) {
        nextConfig = normalizeGradientConfig({
          ...gradientConfig,
          stops: gradientConfig.stops.map((stop, index) =>
            index === 0 ? { ...stop, color: formatColorWithAlpha(parsedSolid.hex, parsedSolid.alpha) } : stop
          )
        });
        setGradientConfig(nextConfig);
      }
      const cssValue = stringifyGradientConfig(nextConfig);
      logStyleControlEvent('Color mode switched to gradient', { fieldKey, value: cssValue });
      onChange(cssValue);
      return;
    }
    logStyleControlEvent('Color mode switched to solid', { fieldKey });
    onChange('');
  };

  const handleAlphaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(event.target.value);
    const normalizedAlpha = clampAlpha(percent / 100);
    const formatted = formatColorWithAlpha(colorPickerValue, normalizedAlpha);
    logStyleControlEvent('Color alpha changed', { fieldKey, alpha: normalizedAlpha });
    onChange(formatted);
  };

  const alphaPercent = Math.round(readColorAlpha(value) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label htmlFor={modeSelectId} className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">
          Mode
        </label>
        <select
          id={modeSelectId}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
          value={colorMode}
          onChange={handleModeChange}
          disabled={readOnly}
        >
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
        {value && !readOnly ? (
          <button type="button" onClick={handleReset} className="text-xs font-semibold text-bw-amber">
            Reset
          </button>
        ) : null}
      </div>
      {colorMode === 'solid' ? (
        <div className="space-y-3">
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
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={alphaInputId}
              className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400"
            >
              Alpha ({alphaPercent}%)
            </label>
            <input
              id={alphaInputId}
              type="range"
              min={0}
              max={100}
              step={1}
              className="w-full"
              value={alphaPercent}
              onChange={handleAlphaChange}
              aria-label="Alpha"
              disabled={readOnly}
            />
          </div>
        </div>
      ) : (
        <GradientBuilder
          config={gradientConfig}
          readOnly={readOnly}
          onConfigChange={updateGradientConfig}
          onManualValueChange={handleManualGradientInput}
          currentValue={value ?? ''}
          fieldKey={fieldKey}
        />
      )}
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

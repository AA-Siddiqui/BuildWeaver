import type { DynamicBindingState } from './types';
import { isDynamicBinding } from './binding-resolver';

const LOG_PREFIX = '[Codegen:StyleMapper]';

export const STYLE_FIELD_KEYS = [
  'layoutDisplay',
  'layoutDirection',
  'layoutWrap',
  'justifyContent',
  'alignItems',
  'gap',
  'position',
  'textAlign',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'width',
  'maxWidth',
  'minHeight',
  'margin',
  'marginX',
  'marginY',
  'padding',
  'paddingX',
  'paddingY',
  'borderRadius',
  'borderWidth',
  'boxShadow',
  'opacity',
  'textColor',
  'backgroundColor',
  'borderColor'
] as const;

export type StyleFieldKey = (typeof STYLE_FIELD_KEYS)[number];

const GRADIENT_PREFIXES = ['linear-gradient', 'radial-gradient'] as const;

const isGradientValue = (value: string): boolean =>
  GRADIENT_PREFIXES.some((prefix) => value.startsWith(prefix));

const readStyleValue = (props: Record<string, unknown>, key: StyleFieldKey): string => {
  const raw = props[key];
  if (isDynamicBinding(raw)) {
    return (raw as DynamicBindingState).fallback ?? '';
  }
  return typeof raw === 'string' ? raw : '';
};

export const extractStyleProps = (
  props: Record<string, unknown>
): { styleProps: Record<string, unknown>; contentProps: Record<string, unknown> } => {
  const styleProps: Record<string, unknown> = {};
  const contentProps: Record<string, unknown> = {};
  const styleKeySet = new Set<string>(STYLE_FIELD_KEYS as unknown as string[]);

  for (const [key, value] of Object.entries(props)) {
    if (styleKeySet.has(key)) {
      styleProps[key] = value;
    } else {
      contentProps[key] = value;
    }
  }

  return { styleProps, contentProps };
};

export const mapStylePropsToCss = (props: Record<string, unknown>): Record<string, string> => {
  const css: Record<string, string> = {};

  const assign = (cssProp: string, value: string): void => {
    if (!value || value === '') return;
    css[cssProp] = value;
  };

  const read = (key: StyleFieldKey): string => readStyleValue(props, key);

  const applyAxis = (value: string, props: string[]): void => {
    if (!value) return;
    props.forEach((prop) => {
      css[prop] = value;
    });
  };

  assign('display', read('layoutDisplay'));
  assign('flexDirection', read('layoutDirection'));
  assign('flexWrap', read('layoutWrap'));
  assign('justifyContent', read('justifyContent'));
  assign('alignItems', read('alignItems'));
  assign('gap', read('gap'));
  assign('position', read('position'));

  assign('textAlign', read('textAlign'));
  assign('fontSize', read('fontSize'));
  assign('fontWeight', read('fontWeight'));
  assign('lineHeight', read('lineHeight'));

  const textColor = read('textColor');
  if (textColor) assign('color', textColor);

  const bgValue = read('backgroundColor');
  if (bgValue) {
    if (isGradientValue(bgValue)) {
      assign('backgroundImage', bgValue);
    } else {
      assign('backgroundColor', bgValue);
    }
  }

  assign('width', read('width'));
  assign('maxWidth', read('maxWidth'));
  assign('minHeight', read('minHeight'));

  assign('margin', read('margin'));
  assign('padding', read('padding'));

  assign('borderRadius', read('borderRadius'));

  const borderWidthValue = read('borderWidth');
  if (borderWidthValue) {
    assign('borderWidth', borderWidthValue);
  }

  const borderColorValue = read('borderColor');
  if (borderColorValue) {
    if (isGradientValue(borderColorValue)) {
      assign('borderImageSlice', '1');
      assign('borderImageSource', borderColorValue);
    } else {
      assign('borderColor', borderColorValue);
    }
  }

  const hasVisibleBorderWidth = Boolean(
    borderWidthValue && !/^0(px)?$/i.test(borderWidthValue.trim())
  );
  if (hasVisibleBorderWidth && !css['borderStyle']) {
    css['borderStyle'] = 'solid';
  }

  assign('boxShadow', read('boxShadow'));
  assign('opacity', read('opacity'));

  applyAxis(read('marginX'), ['marginLeft', 'marginRight']);
  applyAxis(read('marginY'), ['marginTop', 'marginBottom']);
  applyAxis(read('paddingX'), ['paddingLeft', 'paddingRight']);
  applyAxis(read('paddingY'), ['paddingTop', 'paddingBottom']);

  return css;
};

const toCamelCase = (str: string): string =>
  str.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());

export const cssObjectToJsxString = (css: Record<string, string>, indent: number): string => {
  const entries = Object.entries(css).filter(([, v]) => v !== '');
  if (entries.length === 0) return '';

  const pad = ' '.repeat(indent);
  const innerPad = ' '.repeat(indent + 2);
  const props = entries
    .map(([key, value]) => {
      const camel = toCamelCase(key);
      return `${innerPad}${camel}: ${JSON.stringify(value)}`;
    })
    .join(',\n');

  return `${pad}style={{\n${props}\n${pad}}}`;
};

export const cssObjectToInlineStyleAttr = (css: Record<string, string>): string => {
  const entries = Object.entries(css).filter(([, v]) => v !== '');
  if (entries.length === 0) return '';

  const props = entries
    .map(([key, value]) => {
      const camel = toCamelCase(key);
      return `${camel}: ${JSON.stringify(value)}`;
    })
    .join(', ');

  return `style={{ ${props} }}`;
};

export const logStyleMapping = (componentId: string, cssProps: Record<string, string>): void => {
  const count = Object.keys(cssProps).length;
  if (count > 0) {
    console.info(`${LOG_PREFIX} Mapped ${count} style properties for component ${componentId}`);
  }
};

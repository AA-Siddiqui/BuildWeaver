import type { Config, Field } from '@measured/puck';
import type { CSSProperties, ReactNode } from 'react';
import {
  buildAttributeProps,
  createInlineStyle,
  logStyleControlEvent,
  splitStyleProps,
  withStyleFields,
  type StyleableProps
} from './style-controls';
import { attachNodeIdentity, renderScopedCss } from './custom-css';
import {
  type BindingOption,
  type BindingResolver,
  type DynamicBindingValue,
  resolveDynamicBindingValue
} from './dynamic-binding';
import {
  DYNAMIC_SELECT_OPTIONS_METADATA_KEY,
  createDynamicSelectField,
  createDynamicTextField,
  createDynamicTextareaField
} from './dynamic-field-control';

type BuilderConfigParams = {
  bindingOptions: BindingOption[];
  resolveBinding: BindingResolver;
};

type SlotRenderer = ((props?: { className?: string; minEmptyHeight?: number }) => ReactNode) | undefined;

type ColumnsLayout = 'equal' | 'wideLeft' | 'wideRight';

type SectionProps = StyleableProps<{
  eyebrow?: DynamicBindingValue;
  heading?: DynamicBindingValue;
  subheading?: DynamicBindingValue;
  description?: DynamicBindingValue;
  backgroundImage?: DynamicBindingValue;
  contentSlot?: SlotRenderer;
}>;

export const mergeSectionBackgrounds = (
  baseInlineStyle: CSSProperties,
  resolvedBackground?: string,
  sectionId?: string
): CSSProperties => {
  const gradientLayer = typeof baseInlineStyle.backgroundImage === 'string' ? baseInlineStyle.backgroundImage : undefined;
  const photoLayer = resolvedBackground ? `url(${resolvedBackground})` : undefined;
  const mergedLayers = [gradientLayer, photoLayer].filter(Boolean) as string[];
  const mergedBackgroundImage = mergedLayers.length ? mergedLayers.join(', ') : undefined;
  const backgroundSize = photoLayer
    ? gradientLayer
      ? `${baseInlineStyle.backgroundSize ?? 'auto'}, cover`
      : 'cover'
    : baseInlineStyle.backgroundSize;
  const backgroundPosition = photoLayer
    ? gradientLayer
      ? `${baseInlineStyle.backgroundPosition ?? '0% 0%'}, center`
      : 'center'
    : baseInlineStyle.backgroundPosition;

  if (photoLayer && gradientLayer) {
    logStyleControlEvent('Section layering gradient over background image', {
      sectionId,
      gradientLayer,
      photoLayer
    });
  } else if (photoLayer) {
    logStyleControlEvent('Section applying photo background', { sectionId, photoLayer });
  } else if (gradientLayer) {
    logStyleControlEvent('Section applying gradient background', { sectionId, gradientLayer });
  }

  return {
    ...baseInlineStyle,
    backgroundImage: mergedBackgroundImage,
    backgroundSize,
    backgroundPosition
  };
};

type ColumnsProps = StyleableProps<{
  left?: SlotRenderer;
  right?: SlotRenderer;
  layout?: DynamicBindingValue;
  stackAt?: DynamicBindingValue;
}>;

type ImageProps = StyleableProps<{
  src?: DynamicBindingValue;
  alt?: DynamicBindingValue;
  caption?: DynamicBindingValue;
  objectFit?: DynamicBindingValue;
  aspectRatio?: DynamicBindingValue;
}>;

type ListItem = {
  text?: DynamicBindingValue;
  icon?: DynamicBindingValue;
  description?: DynamicBindingValue;
};

type ListProps = StyleableProps<{
  items?: ListItem[];
  variant?: DynamicBindingValue;
}>;

type CardProps = StyleableProps<{
  eyebrow?: DynamicBindingValue;
  heading?: DynamicBindingValue;
  content?: DynamicBindingValue;
  imageUrl?: DynamicBindingValue;
  actionLabel?: DynamicBindingValue;
  actionHref?: DynamicBindingValue;
}>;

type ButtonProps = StyleableProps<{
  label?: DynamicBindingValue;
  variant?: DynamicBindingValue;
  bindingId?: string;
  href?: DynamicBindingValue;
}>;

type HeadingProps = StyleableProps<{
  content?: DynamicBindingValue;
  size?: DynamicBindingValue;
  bindingId?: string;
}>;

type ParagraphProps = StyleableProps<{
  content?: DynamicBindingValue;
  bindingId?: string;
}>;

type SpacerProps = StyleableProps<{
  height?: DynamicBindingValue;
}>;

type ConditionalProps = StyleableProps<{
  activeCaseKey?: DynamicBindingValue;
  cases?: ConditionalCaseConfig[];
}>;

const COMPONENT_ORDER = [
  'Section',
  'Columns',
  'Conditional',
  'Heading',
  'Paragraph',
  'Button',
  'Image',
  'Card',
  'List',
  'Divider',
  'Spacer'
] as const;

const allowAllComponents = COMPONENT_ORDER.filter(Boolean);

const renderSlot = (slot?: SlotRenderer, emptyLabel = 'Drag components here', minEmptyHeight = 60) => {
  if (slot) {
    return slot({ className: 'rounded-xl border border-dashed', minEmptyHeight });
  }
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center text-xs text-gray-500">
      {emptyLabel}
    </div>
  );
};

const RENDER_CONTROL_LOG_PREFIX = '[PageBuilder:RenderControl]';

const logRenderControlEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }
  console.info(`${RENDER_CONTROL_LOG_PREFIX} ${message}`, details ?? '');
};

const BOOLEAN_TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const BOOLEAN_FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

const coerceBooleanString = (value?: string, fallback = true, meta?: Record<string, unknown>): boolean => {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return false;
  }
  logRenderControlEvent('Boolean value fallback applied', { ...meta, raw: value });
  return fallback;
};

const CASE_KEY_SANITIZE_PATTERN = /[^a-z0-9_-]+/g;

type ConditionalCaseConfig = {
  caseKey?: string;
  label?: string;
  slot?: SlotRenderer;
};

type NormalizedConditionalCase = {
  key: string;
  label: string;
  slot?: SlotRenderer;
};

const sanitizeCaseKey = (key: string | undefined, fallback: string, meta?: Record<string, unknown>): string => {
  if (!key || !key.trim()) {
    logRenderControlEvent('Case key missing – using fallback', { ...meta, fallback });
    return fallback;
  }
  const trimmed = key.trim();
  const normalized = trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(CASE_KEY_SANITIZE_PATTERN, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '');
  if (!normalized) {
    logRenderControlEvent('Case key collapsed during normalization', { ...meta, source: key, fallback });
    return fallback;
  }
  if (normalized !== trimmed) {
    logRenderControlEvent('Case key sanitized', { ...meta, source: key, normalized });
  }
  return normalized;
};

const normalizeConditionalCases = (cases: ConditionalCaseConfig[] | undefined, componentId?: string): NormalizedConditionalCase[] => {
  const seen = new Set<string>();
  return (cases ?? []).map((entry, index) => {
    const fallbackKey = `case-${index + 1}`;
    let key = sanitizeCaseKey(entry.caseKey, fallbackKey, { componentId, index });
    if (seen.has(key)) {
      const deduped = `${key}-${index + 1}`;
      logRenderControlEvent('Duplicate case key detected', { componentId, index, key, deduped });
      key = deduped;
    }
    seen.add(key);
    return {
      key,
      label: entry.label?.trim() || `Case ${index + 1}`,
      slot: entry.slot
    } satisfies NormalizedConditionalCase;
  });
};

const buildConditionalSelectOptions = (cases: NormalizedConditionalCase[]) =>
  cases.map((entry) => ({ label: `${entry.label} (${entry.key})`, value: entry.key }));

const getSelectionKey = (
  value: DynamicBindingValue | string | undefined,
  fallbackKey: string | undefined,
  resolver: (input: DynamicBindingValue | string | undefined) => string,
  meta?: Record<string, unknown>
) => {
  const resolved = resolver(value as DynamicBindingValue | string | undefined);
  if (!resolved) {
    if (fallbackKey) {
      logRenderControlEvent('Conditional selection defaulted to fallback', { ...meta, fallbackKey });
    }
    return fallbackKey;
  }
  const normalized = sanitizeCaseKey(resolved, fallbackKey ?? resolved, meta);
  return normalized;
};

const CONDITIONAL_CASE_HELPER_TEXT = 'Provide or bind to a string that matches one of the defined case keys (e.g., "primary-view").';

const getColumnsTemplate = (layout: ColumnsLayout): string => {
  switch (layout) {
    case 'wideLeft':
      return '2fr 3fr';
    case 'wideRight':
      return '3fr 2fr';
    default:
      return '1fr 1fr';
  }
};

const headingFields = (
  bindingOptions: BindingOption[],
  enhance: (fields: Record<string, Field>) => Record<string, Field>
) =>
  enhance({
    content: createDynamicTextareaField({ fieldKey: 'content', bindingOptions, label: 'Content', placeholder: 'Add heading text' }),
    size: createDynamicSelectField({
      fieldKey: 'size',
      bindingOptions,
      label: 'Heading level',
      options: [
        { label: 'H1', value: 'h1' },
        { label: 'H2', value: 'h2' },
        { label: 'H3', value: 'h3' },
        { label: 'H4', value: 'h4' }
      ]
    })
  });

const paragraphFields = (
  bindingOptions: BindingOption[],
  enhance: (fields: Record<string, Field>) => Record<string, Field>
) =>
  enhance({
    content: createDynamicTextareaField({ fieldKey: 'content', bindingOptions, label: 'Content', placeholder: 'Add supporting copy' })
  });

const buttonFields = (
  bindingOptions: BindingOption[],
  enhance: (fields: Record<string, Field>) => Record<string, Field>
) =>
  enhance({
    label: createDynamicTextField({ fieldKey: 'label', bindingOptions, label: 'Label', placeholder: 'Get started' }),
    variant: createDynamicSelectField({
      fieldKey: 'variant',
      bindingOptions,
      label: 'Variant',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Ghost', value: 'ghost' },
        { label: 'Link', value: 'link' }
      ]
    }),
    href: createDynamicTextField({ fieldKey: 'href', bindingOptions, label: 'Href', placeholder: 'https://example.com' })
  });

export const createPageBuilderConfig = ({ bindingOptions, resolveBinding }: BuilderConfigParams): Config => {
  const enhanceFields = (fields: Record<string, Field>) => withStyleFields(fields, bindingOptions);
  const resolveFieldValue = (
    value: DynamicBindingValue | string | undefined,
    legacyBindingId?: string
  ): string => resolveDynamicBindingValue(value as DynamicBindingValue, resolveBinding, legacyBindingId);
  const resolveStyleValue = (value: DynamicBindingValue | undefined) => resolveDynamicBindingValue(value, resolveBinding);
  const resolveBooleanField = (
    value: DynamicBindingValue | string | boolean | undefined,
    fallback = true,
    meta?: { component?: string; field?: string; componentId?: string }
  ): boolean => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === null || typeof value === 'undefined') {
      return fallback;
    }
    return coerceBooleanString(resolveFieldValue(value as DynamicBindingValue | string), fallback, meta);
  };
  const shouldRenderComponent = (
    component: string,
    componentId: string | undefined,
    renderWhen?: DynamicBindingValue | string | boolean
  ) => {
    const isVisible = resolveBooleanField(renderWhen, true, { component, field: 'renderWhen', componentId });
    if (!isVisible) {
      logRenderControlEvent('Component visibility disabled', { component, componentId });
    }
    return isVisible;
  };
  const components: Config['components'] = {
    Heading: {
      label: 'Heading',
      fields: headingFields(bindingOptions, enhanceFields),
      defaultProps: {
        content: 'Design with confidence',
        size: 'h2',
        fontSize: '2.25rem',
        fontWeight: '600'
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { content, size = 'h2', bindingId, customAttributes, customCss, id, renderWhen } = rest as HeadingProps;
        if (!shouldRenderComponent('Heading', id, renderWhen)) {
          return <></>;
        }
        const resolvedContent = resolveFieldValue(content, bindingId);
        const resolvedSize = resolveFieldValue(size);
        const allowedHeadingTags = new Set(['h1', 'h2', 'h3', 'h4']);
        const tagName = allowedHeadingTags.has(resolvedSize) ? resolvedSize : 'h2';
        const Tag = (tagName as keyof JSX.IntrinsicElements) || 'h2';
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <Tag style={createInlineStyle(styleProps, resolveStyleValue)} className="text-bw-ink" {...attributeProps}>
              {resolvedContent}
            </Tag>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Paragraph: {
      label: 'Paragraph',
      fields: paragraphFields(bindingOptions, enhanceFields),
      defaultProps: {
        content: 'Craft modern apps visually and let BuildWeaver handle the scaffolding.',
        textColor: '#4B5563'
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { content, bindingId, customAttributes, customCss, id, renderWhen } = rest as ParagraphProps;
        if (!shouldRenderComponent('Paragraph', id, renderWhen)) {
          return <></>;
        }
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <p style={createInlineStyle(styleProps, resolveStyleValue)} className="text-base leading-relaxed" {...attributeProps}>
              {resolveFieldValue(content, bindingId)}
            </p>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Button: {
      label: 'Button',
      fields: buttonFields(bindingOptions, enhanceFields),
      defaultProps: {
        label: 'Primary action',
        variant: 'primary',
        paddingX: '16px',
        paddingY: '12px',
        borderRadius: '12px'
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { label, variant = 'primary', bindingId, href, customAttributes, customCss, id, renderWhen } = rest as ButtonProps;
        if (!shouldRenderComponent('Button', id, renderWhen)) {
          return <></>;
        }
        const content = resolveFieldValue(label, bindingId);
        const resolvedVariant = resolveFieldValue(variant);
        const nextVariant = ['ghost', 'link', 'primary'].includes(resolvedVariant)
          ? (resolvedVariant as 'ghost' | 'link' | 'primary')
          : 'primary';
        const resolvedHref = resolveFieldValue(href);
        const baseStyle = createInlineStyle(styleProps, resolveStyleValue);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        const className =
          nextVariant === 'ghost'
            ? 'border border-gray-300 bg-transparent text-gray-800'
            : nextVariant === 'link'
              ? 'bg-transparent text-bw-amber underline'
              : 'bg-bw-sand text-bw-ink shadow-sm';
        const Element = resolvedHref ? 'a' : 'button';
        return (
          <>
            <Element
              className={`inline-flex items-center justify-center font-semibold transition hover:opacity-90 ${className}`}
              style={baseStyle}
              href={resolvedHref}
              role={resolvedHref ? 'button' : undefined}
              {...attributeProps}
            >
              {content}
            </Element>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Section: {
      label: 'Section',
      defaultProps: {
        padding: '48px',
        borderRadius: '12px',
        backgroundColor: '#FFFFFF',
        gap: '24px'
      },
      fields: enhanceFields({
        eyebrow: createDynamicTextField({ fieldKey: 'eyebrow', bindingOptions, label: 'Eyebrow', placeholder: 'Product update' }),
        heading: createDynamicTextField({ fieldKey: 'heading', bindingOptions, label: 'Heading', placeholder: 'Hero title' }),
        subheading: createDynamicTextareaField({ fieldKey: 'subheading', bindingOptions, label: 'Subheading', placeholder: 'Supportive copy' }),
        description: createDynamicTextareaField({ fieldKey: 'description', bindingOptions, label: 'Description' }),
        backgroundImage: createDynamicTextField({ fieldKey: 'backgroundImage', bindingOptions, label: 'Background image URL' }),
        contentSlot: {
          type: 'slot',
          label: 'Nested components',
          allow: allowAllComponents
        }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const {
          eyebrow,
          heading,
          subheading,
          description,
          contentSlot,
          backgroundImage,
          customAttributes,
          customCss,
          id,
          renderWhen
        } = rest as SectionProps;
        if (!shouldRenderComponent('Section', id, renderWhen)) {
          return <></>;
        }
        const resolvedEyebrow = resolveFieldValue(eyebrow);
        const resolvedHeading = resolveFieldValue(heading);
        const resolvedSubheading = resolveFieldValue(subheading);
        const resolvedDescription = resolveFieldValue(description);
        const resolvedBackground = resolveFieldValue(backgroundImage);
        const baseInlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const inlineStyle = mergeSectionBackgrounds(baseInlineStyle, resolvedBackground, id);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <section style={inlineStyle} className="relative w-full overflow-hidden border border-gray-100 shadow-sm" {...attributeProps}>
              <div className="space-y-3">
                {resolvedEyebrow && <p className="text-xs uppercase tracking-[0.2em] text-bw-amber">{resolvedEyebrow}</p>}
                {resolvedHeading && <h2 className="text-3xl font-semibold text-bw-ink">{resolvedHeading}</h2>}
                {resolvedSubheading && <p className="text-lg text-gray-600">{resolvedSubheading}</p>}
                {resolvedDescription && <p className="text-base text-gray-500">{resolvedDescription}</p>}
              </div>
              <div className="mt-6">{renderSlot(contentSlot, 'Add components into this section', 120)}</div>
            </section>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Columns: {
      label: 'Columns',
      defaultProps: {
        layout: 'equal',
        stackAt: 'md',
        layoutDisplay: 'grid',
        gap: '24px'
      },
      fields: enhanceFields({
        layout: createDynamicSelectField({
          fieldKey: 'layout',
          bindingOptions,
          label: 'Column ratio',
          options: [
            { label: '50 / 50', value: 'equal' },
            { label: '40 / 60', value: 'wideRight' },
            { label: '60 / 40', value: 'wideLeft' }
          ]
        }),
        stackAt: createDynamicSelectField({
          fieldKey: 'stackAt',
          bindingOptions,
          label: 'Stack breakpoint',
          options: [
            { label: 'Never', value: 'never' },
            { label: 'Medium screens', value: 'md' },
            { label: 'Large screens', value: 'lg' }
          ]
        }),
        left: { type: 'slot', label: 'Left column', allow: allowAllComponents },
        right: { type: 'slot', label: 'Right column', allow: allowAllComponents }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { layout = 'equal', stackAt = 'md', left, right, customAttributes, customCss, id, renderWhen } = rest as ColumnsProps;
        if (!shouldRenderComponent('Columns', id, renderWhen)) {
          return <></>;
        }
        const rawLayout = resolveFieldValue(layout);
        const resolvedLayout: ColumnsLayout = ['wideLeft', 'wideRight', 'equal'].includes(rawLayout as string)
          ? ((rawLayout as ColumnsLayout) ?? 'equal')
          : 'equal';
        const rawStackAt = resolveFieldValue(stackAt);
        const resolvedStackAt: 'never' | 'md' | 'lg' =
          rawStackAt === 'never' || rawStackAt === 'lg' || rawStackAt === 'md' ? (rawStackAt as 'never' | 'md' | 'lg') : 'md';
        const inlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const template = getColumnsTemplate(resolvedLayout);
        const responsiveClass = resolvedStackAt === 'never' ? '' : resolvedStackAt === 'md' ? 'md:grid-cols-2' : 'lg:grid-cols-2';
        const gridClass = resolvedStackAt === 'never' ? 'grid-cols-2' : `grid-cols-1 ${responsiveClass}`.trim();
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <div
              style={{
                ...inlineStyle,
                display: 'grid',
                gridTemplateColumns: resolvedStackAt === 'never' ? template : undefined
              }}
              className={`grid gap-6 ${gridClass}`}
              {...attributeProps}
            >
              <div>{renderSlot(left, 'Left column content')}</div>
              <div>{renderSlot(right, 'Right column content')}</div>
            </div>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Conditional: {
      label: 'Conditional',
      defaultProps: {
        activeCaseKey: 'primary',
        cases: [
          { caseKey: 'primary', label: 'Primary view' },
          { caseKey: 'alternate', label: 'Alternate view' }
        ],
        padding: '24px',
        borderRadius: '12px',
        backgroundColor: '#FFFFFF'
      },
      fields: enhanceFields({
        activeCaseKey: createDynamicSelectField({
          fieldKey: 'activeCaseKey',
          bindingOptions,
          label: 'Active case key',
          helperText: CONDITIONAL_CASE_HELPER_TEXT,
          options: [
            { label: 'Case 1', value: 'case-1' },
            { label: 'Case 2', value: 'case-2' }
          ]
        }),
        cases: {
          type: 'array',
          label: 'Case definitions',
          arrayFields: {
            caseKey: {
              type: 'text',
              label: 'Case key',
              placeholder: 'e.g. primary-view'
            },
            label: {
              type: 'text',
              label: 'Display label',
              placeholder: 'Primary view'
            },
            slot: {
              type: 'slot',
              label: 'Case content',
              allow: allowAllComponents
            }
          },
          defaultItemProps: { caseKey: 'new-case', label: 'New case' },
          getItemSummary: (item: ConditionalCaseConfig, index?: number) => item?.label || item?.caseKey || `Case ${String((index ?? 0) + 1)}`,
          min: 1
        }
      }),
      resolveFields: (data, { fields }) => {
        const conditionalFields = { ...fields };
        const normalizedCases = normalizeConditionalCases(data.props.cases as ConditionalCaseConfig[], data.props.id);
        const options = normalizedCases.length ? buildConditionalSelectOptions(normalizedCases) : [{ label: 'No cases defined', value: '' }];
        if ('activeCaseKey' in conditionalFields) {
          const activeField = conditionalFields.activeCaseKey as ReturnType<typeof createDynamicSelectField>;
          conditionalFields.activeCaseKey = {
            ...activeField,
            metadata: {
              ...(activeField.metadata ?? {}),
              [DYNAMIC_SELECT_OPTIONS_METADATA_KEY]: options
            }
          };
        }
        return conditionalFields;
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { activeCaseKey, cases, customAttributes, customCss, id, renderWhen } = rest as ConditionalProps;
        if (!shouldRenderComponent('Conditional', id, renderWhen)) {
          return <></>;
        }
        const normalizedCases = normalizeConditionalCases(cases, id);
        const inlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        if (!normalizedCases.length) {
          logRenderControlEvent('Conditional component missing cases', { componentId: id });
          return (
            <>
              <div
                style={inlineStyle}
                className="rounded-xl border border-dashed border-red-200 bg-red-50/70 p-4 text-sm text-red-900"
                {...attributeProps}
              >
                <p>Add at least one case to render content.</p>
              </div>
              {renderScopedCss(id, customCss)}
            </>
          );
        }
        const defaultKey = normalizedCases[0]?.key;
        const selectionKey = getSelectionKey(activeCaseKey, defaultKey, (value) => resolveFieldValue(value as DynamicBindingValue), {
          component: 'Conditional',
          componentId: id
        });
        const activeCase = normalizedCases.find((entry) => entry.key === selectionKey) ?? normalizedCases[0];
        if (!activeCase) {
          logRenderControlEvent('Conditional selection fallback used', { componentId: id, selectionKey, fallbackKey: defaultKey });
        }
        const selectionLabel = activeCase?.label ?? 'Selected case';
        const activeSlotRenderer = activeCase?.slot;
        const hasActiveSlotContent = Boolean(activeSlotRenderer);
        const slotNode = renderSlot(activeSlotRenderer, `${selectionLabel} content`, 120);
        if (hasActiveSlotContent) {
          return (
            <>
              <div style={inlineStyle} {...attributeProps}>
                {slotNode}
              </div>
              {renderScopedCss(id, customCss)}
            </>
          );
        }
        return (
          <>
            <div
              style={inlineStyle}
              className="space-y-3 rounded-xl border border-dashed border-bw-amber/60 bg-white/90 p-4"
              {...attributeProps}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-gray-500">
                <span>Conditional render</span>
                <div className="flex items-center gap-2 text-[0.6rem] normal-case tracking-normal text-gray-500">
                  <span>Expecting case key string</span>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.65rem] text-gray-700">{selectionKey ?? defaultKey}</code>
                </div>
              </div>
              <p className="text-xs text-gray-500">{CONDITIONAL_CASE_HELPER_TEXT}</p>
              <div>{slotNode}</div>
            </div>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Image: {
      label: 'Image',
      defaultProps: {
        src: 'https://placehold.co/800x500/FFF7E0/2B2B2B?text=Image',
        borderRadius: '12px'
      },
      fields: enhanceFields({
        src: createDynamicTextField({ fieldKey: 'src', bindingOptions, label: 'Source URL', placeholder: 'https://...' }),
        alt: createDynamicTextField({ fieldKey: 'alt', bindingOptions, label: 'Alt text' }),
        caption: createDynamicTextField({ fieldKey: 'caption', bindingOptions, label: 'Caption' }),
        objectFit: createDynamicSelectField({
          fieldKey: 'objectFit',
          bindingOptions,
          label: 'Object fit',
          options: [
            { label: 'Cover', value: 'cover' },
            { label: 'Contain', value: 'contain' },
            { label: 'Fill', value: 'fill' }
          ]
        }),
        aspectRatio: createDynamicSelectField({
          fieldKey: 'aspectRatio',
          bindingOptions,
          label: 'Aspect ratio',
          options: [
            { label: 'Auto', value: '' },
            { label: '16 : 9', value: '16 / 9' },
            { label: '4 : 3', value: '4 / 3' },
            { label: 'Square', value: '1 / 1' }
          ]
        })
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { src, alt, caption, objectFit = 'cover', aspectRatio, customAttributes, customCss, id, renderWhen } = rest as ImageProps;
        if (!shouldRenderComponent('Image', id, renderWhen)) {
          return <></>;
        }
        const resolvedSrc = resolveFieldValue(src);
        const resolvedAlt = resolveFieldValue(alt);
        const resolvedCaption = resolveFieldValue(caption);
        const resolvedObjectFit = (resolveFieldValue(objectFit) as CSSProperties['objectFit']) || 'cover';
        const resolvedAspectRatio = resolveFieldValue(aspectRatio);
        const inlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <figure style={inlineStyle} className="space-y-2" {...attributeProps}>
              <div className="w-full overflow-hidden rounded-xl bg-gray-100">
                <img
                  src={resolvedSrc}
                  alt={resolvedAlt}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: resolvedObjectFit,
                    aspectRatio: resolvedAspectRatio || undefined
                  }}
                  className="block"
                />
              </div>
              {resolvedCaption && <figcaption className="text-sm text-gray-500">{resolvedCaption}</figcaption>}
            </figure>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Card: {
      label: 'Card',
      defaultProps: {
        padding: '32px',
        borderRadius: '16px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)'
      },
      fields: enhanceFields({
        eyebrow: createDynamicTextField({ fieldKey: 'eyebrow', bindingOptions, label: 'Eyebrow' }),
        heading: createDynamicTextField({ fieldKey: 'heading', bindingOptions, label: 'Heading' }),
        content: createDynamicTextareaField({ fieldKey: 'content', bindingOptions, label: 'Body' }),
        imageUrl: createDynamicTextField({ fieldKey: 'imageUrl', bindingOptions, label: 'Image URL' }),
        actionLabel: createDynamicTextField({ fieldKey: 'actionLabel', bindingOptions, label: 'Action label' }),
        actionHref: createDynamicTextField({ fieldKey: 'actionHref', bindingOptions, label: 'Action link' })
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const {
          eyebrow,
          heading,
          content,
          imageUrl,
          actionHref,
          actionLabel,
          customAttributes,
          customCss,
          id,
          renderWhen
        } = rest as CardProps;
        if (!shouldRenderComponent('Card', id, renderWhen)) {
          return <></>;
        }
        const inlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        const resolvedEyebrow = resolveFieldValue(eyebrow);
        const resolvedHeading = resolveFieldValue(heading);
        const resolvedContent = resolveFieldValue(content);
        const resolvedImage = resolveFieldValue(imageUrl);
        const resolvedActionLabel = resolveFieldValue(actionLabel);
        const resolvedActionHref = resolveFieldValue(actionHref);
        return (
          <>
            <article style={inlineStyle} className="flex flex-col gap-4 border border-gray-100" {...attributeProps}>
              {resolvedImage && (
                <img src={resolvedImage} alt={resolvedHeading ?? ''} className="h-48 w-full rounded-xl object-cover" />
              )}
              <div className="space-y-2">
                {resolvedEyebrow && <p className="text-xs uppercase tracking-[0.2em] text-bw-amber">{resolvedEyebrow}</p>}
                {resolvedHeading && <h3 className="text-xl font-semibold text-bw-ink">{resolvedHeading}</h3>}
                {resolvedContent && <p className="text-base text-gray-600">{resolvedContent}</p>}
              </div>
              {resolvedActionLabel && (
                <a href={resolvedActionHref} className="text-sm font-semibold text-bw-amber">
                  {resolvedActionLabel}
                </a>
              )}
            </article>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    List: {
      label: 'List',
      defaultProps: {
        variant: 'bullet',
        gap: '12px'
      },
      fields: enhanceFields({
        variant: createDynamicSelectField({
          fieldKey: 'variant',
          bindingOptions,
          label: 'Variant',
          options: [
            { label: 'Bulleted', value: 'bullet' },
            { label: 'Numbered', value: 'numbered' },
            { label: 'Plain', value: 'plain' }
          ]
        }),
        items: {
          type: 'array',
          label: 'Items',
          arrayFields: {
            text: createDynamicTextField({ fieldKey: 'text', bindingOptions, label: 'Text' }),
            description: createDynamicTextareaField({ fieldKey: 'description', bindingOptions, label: 'Description' }),
            icon: createDynamicTextField({ fieldKey: 'icon', bindingOptions, label: 'Leading icon' })
          },
          defaultItemProps: { text: 'List item' },
          getItemSummary: (item: ListItem, index?: number) =>
            resolveFieldValue(item.text) || `Item ${String((index ?? 0) + 1)}`
        }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { items = [], variant = 'bullet', customAttributes, customCss, id, renderWhen } = rest as ListProps;
        if (!shouldRenderComponent('List', id, renderWhen)) {
          return <></>;
        }
        const inlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        const resolvedVariantRaw = resolveFieldValue(variant);
        const resolvedVariant = ['bullet', 'numbered', 'plain'].includes(resolvedVariantRaw)
          ? (resolvedVariantRaw as 'bullet' | 'numbered' | 'plain')
          : 'bullet';
        const resolvedItems = items.map((item) => ({
          text: resolveFieldValue(item.text),
          description: resolveFieldValue(item.description),
          icon: resolveFieldValue(item.icon)
        }));
        const listClass =
          resolvedVariant === 'numbered'
            ? 'list-decimal pl-6'
            : resolvedVariant === 'bullet'
              ? 'list-disc pl-6'
              : 'space-y-3';
        const renderItem = (item: { text?: string | null; description?: string | null }, index: number) => (
          <li key={`${item?.text ?? index}-${index}`} className="space-y-1 text-gray-700">
            <div className="font-medium text-bw-ink">{item?.text || `Item ${index + 1}`}</div>
            {item?.description && <p className="text-sm text-gray-500">{item?.description}</p>}
          </li>
        );
        if (resolvedVariant === 'plain') {
          return (
            <>
              <div style={inlineStyle} className="space-y-3" {...attributeProps}>
                {resolvedItems.map((item, index) => (
                  <div key={`${item?.text ?? index}-${index}`} className="border-l-2 border-bw-amber/30 pl-4 text-gray-700">
                    <div className="font-medium text-bw-ink">{item?.text || `Item ${index + 1}`}</div>
                    {item?.description && <p className="text-sm text-gray-500">{item?.description}</p>}
                  </div>
                ))}
              </div>
              {renderScopedCss(id, customCss)}
            </>
          );
        }
        return (
          <>
            <ul style={inlineStyle} className={listClass} {...attributeProps}>
              {resolvedItems.map((item, index) => renderItem(item, index))}
            </ul>
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Divider: {
      label: 'Divider',
      defaultProps: {
        marginY: '24px',
        borderColor: 'rgba(15, 23, 42, 0.08)',
        borderWidth: '1px'
      },
      fields: enhanceFields({}),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { customAttributes, customCss, id, renderWhen } = rest as StyleableProps<Record<string, never>>;
        if (!shouldRenderComponent('Divider', id, renderWhen)) {
          return <></>;
        }
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <hr style={createInlineStyle(styleProps, resolveStyleValue)} className="w-full" {...attributeProps} />
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    },
    Spacer: {
      label: 'Spacer',
      defaultProps: {
        height: '48px'
      },
      fields: enhanceFields({
        height: createDynamicSelectField({
          fieldKey: 'height',
          bindingOptions,
          label: 'Height',
          options: [
            { label: 'XS (16px)', value: '16px' },
            { label: 'SM (24px)', value: '24px' },
            { label: 'MD (48px)', value: '48px' },
            { label: 'LG (72px)', value: '72px' },
            { label: 'XL (96px)', value: '96px' }
          ]
        })
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { height = '48px', customAttributes, customCss, id, renderWhen } = rest as SpacerProps;
        if (!shouldRenderComponent('Spacer', id, renderWhen)) {
          return <></>;
        }
        const inlineStyle = createInlineStyle(styleProps, resolveStyleValue);
        const attributeProps = attachNodeIdentity(id, buildAttributeProps(customAttributes));
        return (
          <>
            <div style={{ ...inlineStyle, height: resolveFieldValue(height) || '48px' }} aria-hidden="true" {...attributeProps} />
            {renderScopedCss(id, customCss)}
          </>
        );
      }
    }
  };

  return {
    categories: {
      layout: { title: 'Layout', components: ['Section', 'Columns', 'Conditional', 'Divider', 'Spacer'] },
      content: { title: 'Content', components: ['Heading', 'Paragraph', 'Card', 'List'] },
      media: { title: 'Media', components: ['Image'] },
      actions: { title: 'Actions', components: ['Button'] }
    },
    components
  } satisfies Config;
};

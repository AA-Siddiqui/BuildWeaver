import type { Config, Field } from '@measured/puck';
import type { CSSProperties, ReactNode } from 'react';
import {
  buildAttributeProps,
  createInlineStyle,
  splitStyleProps,
  withStyleFields,
  type StyleableProps
} from './style-controls';

type BindingOption = { label: string; value: string };

type BuilderConfigParams = {
  bindingOptions: BindingOption[];
  resolveBinding: (text?: string, bindingId?: string) => string;
};

type SlotRenderer = ((props?: { className?: string; minEmptyHeight?: number }) => ReactNode) | undefined;

type ColumnsLayout = 'equal' | 'wideLeft' | 'wideRight';

type SectionProps = StyleableProps<{
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  description?: string;
  backgroundImage?: string;
  contentSlot?: SlotRenderer;
}>;

type ColumnsProps = StyleableProps<{
  left?: SlotRenderer;
  right?: SlotRenderer;
  layout?: ColumnsLayout;
  stackAt?: 'never' | 'md' | 'lg';
}>;

type ImageProps = StyleableProps<{
  src?: string;
  alt?: string;
  caption?: string;
  objectFit?: string;
  aspectRatio?: string;
}>;

type ListItem = {
  text?: string;
  icon?: string;
  description?: string;
};

type ListProps = StyleableProps<{
  items?: ListItem[];
  variant?: 'bullet' | 'numbered' | 'plain';
}>;

type CardProps = StyleableProps<{
  eyebrow?: string;
  heading?: string;
  content?: string;
  imageUrl?: string;
  actionLabel?: string;
  actionHref?: string;
}>;

type ButtonProps = StyleableProps<{
  label?: string;
  variant?: 'primary' | 'ghost' | 'link';
  bindingId?: string;
  href?: string;
}>;

type HeadingProps = StyleableProps<{
  content?: string;
  size?: string;
  bindingId?: string;
}>;

type ParagraphProps = StyleableProps<{
  content?: string;
  bindingId?: string;
}>;

type SpacerProps = StyleableProps<{
  height?: string;
}>;

const COMPONENT_ORDER = [
  'Section',
  'Columns',
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
    return slot({ className: 'rounded-xl border border-dashed border-gray-200 bg-gray-50', minEmptyHeight });
  }
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center text-xs text-gray-500">
      {emptyLabel}
    </div>
  );
};

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

const styleableFields = (fields: Record<string, Field>) => withStyleFields(fields);

const headingFields = (bindingOptions: BindingOption[]) =>
  styleableFields({
    content: { type: 'textarea', label: 'Content', placeholder: 'Add heading text' },
    size: {
      type: 'select',
      label: 'Heading level',
      options: [
        { label: 'H1', value: 'h1' },
        { label: 'H2', value: 'h2' },
        { label: 'H3', value: 'h3' },
        { label: 'H4', value: 'h4' }
      ]
    },
    bindingId: { type: 'select', label: 'Dynamic value', options: bindingOptions }
  });

const paragraphFields = (bindingOptions: BindingOption[]) =>
  styleableFields({
    content: { type: 'textarea', label: 'Content', placeholder: 'Add supporting copy' },
    bindingId: { type: 'select', label: 'Dynamic value', options: bindingOptions }
  });

const buttonFields = (bindingOptions: BindingOption[]) =>
  styleableFields({
    label: { type: 'text', label: 'Label', placeholder: 'Get started' },
    bindingId: { type: 'select', label: 'Dynamic value', options: bindingOptions },
    variant: {
      type: 'select',
      label: 'Variant',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Ghost', value: 'ghost' },
        { label: 'Link', value: 'link' }
      ]
    },
    href: { type: 'text', label: 'Href', placeholder: 'https://example.com' }
  });

export const createPageBuilderConfig = ({ bindingOptions, resolveBinding }: BuilderConfigParams): Config => {
  const components: Config['components'] = {
    Heading: {
      label: 'Heading',
      fields: headingFields(bindingOptions),
      defaultProps: {
        content: 'Design with confidence',
        size: 'h2',
        fontSize: '2.25rem',
        fontWeight: '600'
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { content, size = 'h2', bindingId, customAttributes } = rest as HeadingProps;
        const Tag = (size as keyof JSX.IntrinsicElements) || 'h2';
        const resolvedContent = resolveBinding(content, bindingId);
        const attributeProps = buildAttributeProps(customAttributes);
        return (
          <Tag style={createInlineStyle(styleProps)} className="text-bw-ink" {...attributeProps}>
            {resolvedContent}
          </Tag>
        );
      }
    },
    Paragraph: {
      label: 'Paragraph',
      fields: paragraphFields(bindingOptions),
      defaultProps: {
        content: 'Craft modern apps visually and let BuildWeaver handle the scaffolding.',
        textColor: '#4B5563'
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { content, bindingId, customAttributes } = rest as ParagraphProps;
        const attributeProps = buildAttributeProps(customAttributes);
        return (
          <p style={createInlineStyle(styleProps)} className="text-base leading-relaxed" {...attributeProps}>
            {resolveBinding(content, bindingId)}
          </p>
        );
      }
    },
    Button: {
      label: 'Button',
      fields: buttonFields(bindingOptions),
      defaultProps: {
        label: 'Primary action',
        variant: 'primary',
        paddingX: '16px',
        paddingY: '12px',
        borderRadius: '12px'
      },
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { label, variant = 'primary', bindingId, href, customAttributes } = rest as ButtonProps;
        const content = resolveBinding(label, bindingId);
        const baseStyle = createInlineStyle(styleProps);
        const attributeProps = buildAttributeProps(customAttributes);
        const className =
          variant === 'ghost'
            ? 'border border-gray-300 bg-transparent text-gray-800'
            : variant === 'link'
              ? 'bg-transparent text-bw-amber underline'
              : 'bg-bw-sand text-bw-ink shadow-sm';
        const Element = href ? 'a' : 'button';
        return (
          <Element
            className={`inline-flex items-center justify-center font-semibold transition hover:opacity-90 ${className}`}
            style={baseStyle}
            href={href}
            role={href ? 'button' : undefined}
            {...attributeProps}
          >
            {content}
          </Element>
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
      fields: styleableFields({
        eyebrow: { type: 'text', label: 'Eyebrow', placeholder: 'Product update' },
        heading: { type: 'text', label: 'Heading', placeholder: 'Hero title' },
        subheading: { type: 'textarea', label: 'Subheading', placeholder: 'Supportive copy' },
        description: { type: 'textarea', label: 'Description' },
        backgroundImage: { type: 'text', label: 'Background image URL' },
        contentSlot: {
          type: 'slot',
          label: 'Nested components',
          allow: allowAllComponents
        }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { eyebrow, heading, subheading, description, contentSlot, backgroundImage, customAttributes } = rest as SectionProps;
        const inlineStyle = {
          ...createInlineStyle(styleProps),
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: backgroundImage ? 'cover' : undefined,
          backgroundPosition: backgroundImage ? 'center' : undefined
        };
        const attributeProps = buildAttributeProps(customAttributes);
        return (
          <section style={inlineStyle} className="relative w-full overflow-hidden border border-gray-100 shadow-sm" {...attributeProps}>
            <div className="space-y-3">
              {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-bw-amber">{eyebrow}</p>}
              {heading && <h2 className="text-3xl font-semibold text-bw-ink">{heading}</h2>}
              {subheading && <p className="text-lg text-gray-600">{subheading}</p>}
              {description && <p className="text-base text-gray-500">{description}</p>}
            </div>
            <div className="mt-6">{renderSlot(contentSlot, 'Add components into this section', 120)}</div>
          </section>
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
      fields: styleableFields({
        layout: {
          type: 'select',
          label: 'Column ratio',
          options: [
            { label: '50 / 50', value: 'equal' },
            { label: '40 / 60', value: 'wideRight' },
            { label: '60 / 40', value: 'wideLeft' }
          ]
        },
        stackAt: {
          type: 'select',
          label: 'Stack breakpoint',
          options: [
            { label: 'Never', value: 'never' },
            { label: 'Medium screens', value: 'md' },
            { label: 'Large screens', value: 'lg' }
          ]
        },
        left: { type: 'slot', label: 'Left column', allow: allowAllComponents },
        right: { type: 'slot', label: 'Right column', allow: allowAllComponents }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { layout = 'equal', stackAt = 'md', left, right, customAttributes } = rest as ColumnsProps;
        const inlineStyle = createInlineStyle(styleProps);
        const template = getColumnsTemplate(layout);
        const responsiveClass = stackAt === 'never' ? '' : stackAt === 'md' ? 'md:grid-cols-2' : 'lg:grid-cols-2';
        const gridClass = stackAt === 'never' ? 'grid-cols-2' : `grid-cols-1 ${responsiveClass}`.trim();
        const attributeProps = buildAttributeProps(customAttributes);
        return (
          <div
            style={{
              ...inlineStyle,
              display: 'grid',
              gridTemplateColumns: stackAt === 'never' ? template : undefined
            }}
            className={`grid gap-6 ${gridClass}`}
            {...attributeProps}
          >
            <div>{renderSlot(left, 'Left column content')}</div>
            <div>{renderSlot(right, 'Right column content')}</div>
          </div>
        );
      }
    },
    Image: {
      label: 'Image',
      defaultProps: {
        src: 'https://placehold.co/800x500/FFF7E0/2B2B2B?text=Image',
        borderRadius: '12px'
      },
      fields: styleableFields({
        src: { type: 'text', label: 'Source URL', placeholder: 'https://...' },
        alt: { type: 'text', label: 'Alt text' },
        caption: { type: 'text', label: 'Caption' },
        objectFit: {
          type: 'select',
          label: 'Object fit',
          options: [
            { label: 'Cover', value: 'cover' },
            { label: 'Contain', value: 'contain' },
            { label: 'Fill', value: 'fill' }
          ]
        },
        aspectRatio: {
          type: 'select',
          label: 'Aspect ratio',
          options: [
            { label: 'Auto', value: '' },
            { label: '16 : 9', value: '16 / 9' },
            { label: '4 : 3', value: '4 / 3' },
            { label: 'Square', value: '1 / 1' }
          ]
        }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { src, alt, caption, objectFit = 'cover', aspectRatio, customAttributes } = rest as ImageProps;
        const inlineStyle = createInlineStyle(styleProps);
        const attributeProps = buildAttributeProps(customAttributes);
        return (
          <figure style={inlineStyle} className="space-y-2" {...attributeProps}>
            <div className="w-full overflow-hidden rounded-xl bg-gray-100">
              <img
                src={src}
                alt={alt}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: (objectFit as CSSProperties['objectFit']) ?? 'cover',
                  aspectRatio: aspectRatio || undefined
                }}
                className="block"
              />
            </div>
            {caption && <figcaption className="text-sm text-gray-500">{caption}</figcaption>}
          </figure>
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
      fields: styleableFields({
        eyebrow: { type: 'text', label: 'Eyebrow' },
        heading: { type: 'text', label: 'Heading' },
        content: { type: 'textarea', label: 'Body' },
        imageUrl: { type: 'text', label: 'Image URL' },
        actionLabel: { type: 'text', label: 'Action label' },
        actionHref: { type: 'text', label: 'Action link' }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { eyebrow, heading, content, imageUrl, actionHref, actionLabel, customAttributes } = rest as CardProps;
        const inlineStyle = createInlineStyle(styleProps);
        const attributeProps = buildAttributeProps(customAttributes);
        return (
          <article style={inlineStyle} className="flex flex-col gap-4 border border-gray-100" {...attributeProps}>
            {imageUrl && (
              <img src={imageUrl} alt={heading ?? ''} className="h-48 w-full rounded-xl object-cover" />
            )}
            <div className="space-y-2">
              {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-bw-amber">{eyebrow}</p>}
              {heading && <h3 className="text-xl font-semibold text-bw-ink">{heading}</h3>}
              {content && <p className="text-base text-gray-600">{content}</p>}
            </div>
            {actionLabel && (
              <a href={actionHref} className="text-sm font-semibold text-bw-amber">
                {actionLabel}
              </a>
            )}
          </article>
        );
      }
    },
    List: {
      label: 'List',
      defaultProps: {
        variant: 'bullet',
        gap: '12px'
      },
      fields: styleableFields({
        variant: {
          type: 'select',
          label: 'Variant',
          options: [
            { label: 'Bulleted', value: 'bullet' },
            { label: 'Numbered', value: 'numbered' },
            { label: 'Plain', value: 'plain' }
          ]
        },
        items: {
          type: 'array',
          label: 'Items',
          arrayFields: {
            text: { type: 'text', label: 'Text' },
            description: { type: 'textarea', label: 'Description' },
            icon: { type: 'text', label: 'Leading icon' }
          },
          defaultItemProps: { text: 'List item' },
          getItemSummary: (item: ListItem, index?: number) => item.text || `Item ${String(index ?? 0 + 1)}`
        }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { items = [], variant = 'bullet', customAttributes } = rest as ListProps;
        const inlineStyle = createInlineStyle(styleProps);
        const attributeProps = buildAttributeProps(customAttributes);
        const listClass =
          variant === 'numbered'
            ? 'list-decimal pl-6'
            : variant === 'bullet'
              ? 'list-disc pl-6'
              : 'space-y-3';
        const renderItem = (item: ListItem, index: number) => (
          <li key={`${item.text}-${index}`} className="space-y-1 text-gray-700">
            <div className="font-medium text-bw-ink">{item.text || `Item ${index + 1}`}</div>
            {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
          </li>
        );
        if (variant === 'plain') {
          return (
            <div style={inlineStyle} className="space-y-3" {...attributeProps}>
              {items.map((item, index) => (
                <div key={`${item.text}-${index}`} className="border-l-2 border-bw-amber/30 pl-4 text-gray-700">
                  <div className="font-medium text-bw-ink">{item.text || `Item ${index + 1}`}</div>
                  {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                </div>
              ))}
            </div>
          );
        }
        return (
          <ul style={inlineStyle} className={listClass} {...attributeProps}>
            {items.map((item, index) => renderItem(item, index))}
          </ul>
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
      fields: styleableFields({}),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { customAttributes } = rest as StyleableProps<Record<string, never>>;
        const attributeProps = buildAttributeProps(customAttributes);
        return <hr style={createInlineStyle(styleProps)} className="w-full" {...attributeProps} />;
      }
    },
    Spacer: {
      label: 'Spacer',
      defaultProps: {
        height: '48px'
      },
      fields: styleableFields({
        height: {
          type: 'select',
          label: 'Height',
          options: [
            { label: 'XS (16px)', value: '16px' },
            { label: 'SM (24px)', value: '24px' },
            { label: 'MD (48px)', value: '48px' },
            { label: 'LG (72px)', value: '72px' },
            { label: 'XL (96px)', value: '96px' }
          ]
        }
      }),
      render: (props) => {
        const { styleProps, rest } = splitStyleProps(props);
        const { height = '48px', customAttributes } = rest as SpacerProps;
        const inlineStyle = createInlineStyle(styleProps);
        const attributeProps = buildAttributeProps(customAttributes);
        return <div style={{ ...inlineStyle, height }} aria-hidden="true" {...attributeProps} />;
      }
    }
  };

  return {
    categories: {
      layout: { title: 'Layout', components: ['Section', 'Columns', 'Divider', 'Spacer'] },
      content: { title: 'Content', components: ['Heading', 'Paragraph', 'Card', 'List'] },
      media: { title: 'Media', components: ['Image'] },
      actions: { title: 'Actions', components: ['Button'] }
    },
    components
  } satisfies Config;
};

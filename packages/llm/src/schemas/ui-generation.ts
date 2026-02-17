import { z } from 'zod';

// ── Shared style schema ────────────────────────────────────────────
//
// Every AI-generated component carries a `style` object so that the LLM
// can apply visual styling inline with layout generation (not as a
// separate step). All fields are required – sentinel values ("" or
// "inherit") indicate "no opinion / use editor default".

const AiComponentStyleSchema = z.object({
  textColor: z.string().describe('CSS colour for text e.g. "#111827", "#FFFFFF". Use "" for default'),
  backgroundColor: z.string().describe('CSS background colour e.g. "#F9E7B2", "#1a1a2e". Use "" for default/transparent'),
  padding: z.string().describe('CSS padding e.g. "16px", "24px 32px", "48px 64px". Use "" for none/default'),
  margin: z.string().describe('CSS margin e.g. "0px", "16px auto", "24px 0". Use "" for none/default'),
  fontSize: z.string().describe('CSS font-size e.g. "1rem", "1.25rem", "1.5rem", "2.25rem". Use "" to inherit'),
  fontWeight: z.enum(['inherit', '300', '400', '500', '600', '700']).describe('Font weight. Use "inherit" for default'),
  textAlign: z.enum(['inherit', 'left', 'center', 'right']).describe('Text alignment. Use "inherit" for default'),
  borderRadius: z.string().describe('CSS border-radius e.g. "0px", "6px", "12px", "999px". Use "" for default'),
  borderWidth: z.string().describe('CSS border-width e.g. "1px", "2px". Use "" for no border'),
  borderColor: z.string().describe('CSS border colour e.g. "#E5E7EB". Use "" for no border'),
  boxShadow: z.string().describe('CSS box-shadow e.g. "0 4px 12px rgba(0,0,0,0.08)". Use "" for none'),
  maxWidth: z.string().describe('CSS max-width e.g. "960px", "1200px", "100%". Use "" for default'),
  opacity: z.string().describe('CSS opacity "0" to "1". Use "" for fully opaque')
});

export type AiComponentStyle = z.infer<typeof AiComponentStyleSchema>;

/**
 * Default "no styling" object. Every field is set to its sentinel value
 * so the editor falls back to its own defaults.
 */
export const AI_DEFAULT_STYLE: AiComponentStyle = {
  textColor: '',
  backgroundColor: '',
  padding: '',
  margin: '',
  fontSize: '',
  fontWeight: 'inherit',
  textAlign: 'inherit',
  borderRadius: '',
  borderWidth: '',
  borderColor: '',
  boxShadow: '',
  maxWidth: '',
  opacity: ''
};

// ── Individual AI UI component schemas ─────────────────────────────
//
// IMPORTANT: No field uses .optional() because some LLM providers (e.g. GROQ)
// do not support the "not" keyword in JSON Schema, which Zod generates for
// optional fields via anyOf. Instead, all fields are required.
// String fields use "" (empty string) as a sentinel for "not provided".
// Enum fields always require a valid selection.

const AiHeadingComponent = z.object({
  type: z.literal('Heading'),
  content: z.string().describe('The heading text to display'),
  size: z.enum(['h1', 'h2', 'h3', 'h4']).describe('Heading level'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this heading')
});

const AiParagraphComponent = z.object({
  type: z.literal('Paragraph'),
  content: z.string().describe('The paragraph text to display'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this paragraph')
});

const AiButtonComponent = z.object({
  type: z.literal('Button'),
  label: z.string().describe('Button label text'),
  variant: z.enum(['primary', 'ghost', 'link']).describe('Visual style variant'),
  href: z.string().describe('Link URL for the button. Use "" (empty string) if no link is needed'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this button')
});

const AiImageComponent = z.object({
  type: z.literal('Image'),
  src: z.string().describe('Image URL or placeholder'),
  alt: z.string().describe('Alt text for accessibility'),
  objectFit: z.enum(['cover', 'contain', 'fill', 'none']).describe('How image fills its container. Use "cover" as default'),
  aspectRatio: z.enum(['auto', '1/1', '4/3', '16/9', '21/9']).describe('Aspect ratio of image. Use "auto" as default'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this image')
});

const AiCardComponent = z.object({
  type: z.literal('Card'),
  heading: z.string().describe('Card heading'),
  content: z.string().describe('Card body text'),
  eyebrow: z.string().describe('Small text above heading. Use "" (empty string) if not needed'),
  imageUrl: z.string().describe('Card image URL. Use "" (empty string) if not needed'),
  actionLabel: z.string().describe('Action button label. Use "" (empty string) if not needed'),
  actionHref: z.string().describe('Action button URL. Use "" (empty string) if not needed'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this card')
});

const AiListItemComponent = z.object({
  text: z.string().describe('List item text'),
  description: z.string().describe('Description for item. Use "" (empty string) if not needed')
});

const AiListComponent = z.object({
  type: z.literal('List'),
  items: z.array(AiListItemComponent).min(1).max(20).describe('List items'),
  variant: z.enum(['unordered', 'ordered', 'plain']).describe('List style'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this list')
});

const AiDividerComponent = z.object({
  type: z.literal('Divider'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this divider')
});

const AiSpacerComponent = z.object({
  type: z.literal('Spacer'),
  height: z.enum(['16px', '24px', '48px', '72px', '96px']).describe('Spacer height'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this spacer')
});

// ── Children-bearing containers reference inner content ──────────

const AiSectionChild = z.discriminatedUnion('type', [
  AiHeadingComponent,
  AiParagraphComponent,
  AiButtonComponent,
  AiImageComponent,
  AiCardComponent,
  AiListComponent,
  AiDividerComponent,
  AiSpacerComponent
]);

export type AiSectionChild = z.infer<typeof AiSectionChild>;

const AiColumnChild = z.discriminatedUnion('type', [
  AiHeadingComponent,
  AiParagraphComponent,
  AiButtonComponent,
  AiImageComponent,
  AiCardComponent,
  AiListComponent,
  AiDividerComponent,
  AiSpacerComponent
]);

const AiColumnsComponent = z.object({
  type: z.literal('Columns'),
  layout: z.enum(['equal', 'wideLeft', 'wideRight']).describe('Column width distribution'),
  left: z.array(AiColumnChild).min(1).max(10).describe('Left column children'),
  right: z.array(AiColumnChild).min(1).max(10).describe('Right column children'),
  style: AiComponentStyleSchema.describe('Visual style overrides for this columns container')
});

const AiSectionContentItem = z.discriminatedUnion('type', [
  AiHeadingComponent,
  AiParagraphComponent,
  AiButtonComponent,
  AiImageComponent,
  AiCardComponent,
  AiListComponent,
  AiDividerComponent,
  AiSpacerComponent,
  AiColumnsComponent
]);

export type AiSectionContentItem = z.infer<typeof AiSectionContentItem>;

const AiSectionComponent = z.object({
  type: z.literal('Section'),
  backgroundColor: z.string().describe('CSS background colour e.g. "#FFFFFF". Always provide a value, use "#FFFFFF" as default'),
  style: AiComponentStyleSchema.describe('Additional visual style overrides for this section (padding, text colour, etc.). Section backgroundColor above takes priority over style.backgroundColor'),
  children: z.array(AiSectionContentItem).min(1).max(20).describe('Components inside this section')
});

export type AiSectionComponent = z.infer<typeof AiSectionComponent>;

// ── Top-level UI generation result ─────────────────────────────────

export const AiUiGenerationResultSchema = z.object({
  sections: z.array(AiSectionComponent).min(1).max(10).describe('Page sections, each containing child components'),
  summary: z.string().describe('One-sentence description of the generated UI')
});

export type AiUiGenerationResult = z.infer<typeof AiUiGenerationResultSchema>;

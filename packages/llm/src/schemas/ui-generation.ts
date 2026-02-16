import { z } from 'zod';

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
  size: z.enum(['h1', 'h2', 'h3', 'h4']).describe('Heading level')
});

const AiParagraphComponent = z.object({
  type: z.literal('Paragraph'),
  content: z.string().describe('The paragraph text to display')
});

const AiButtonComponent = z.object({
  type: z.literal('Button'),
  label: z.string().describe('Button label text'),
  variant: z.enum(['primary', 'ghost', 'link']).describe('Visual style variant'),
  href: z.string().describe('Link URL for the button. Use "" (empty string) if no link is needed')
});

const AiImageComponent = z.object({
  type: z.literal('Image'),
  src: z.string().describe('Image URL or placeholder'),
  alt: z.string().describe('Alt text for accessibility'),
  objectFit: z.enum(['cover', 'contain', 'fill', 'none']).describe('How image fills its container. Use "cover" as default'),
  aspectRatio: z.enum(['auto', '1/1', '4/3', '16/9', '21/9']).describe('Aspect ratio of image. Use "auto" as default')
});

const AiCardComponent = z.object({
  type: z.literal('Card'),
  heading: z.string().describe('Card heading'),
  content: z.string().describe('Card body text'),
  eyebrow: z.string().describe('Small text above heading. Use "" (empty string) if not needed'),
  imageUrl: z.string().describe('Card image URL. Use "" (empty string) if not needed'),
  actionLabel: z.string().describe('Action button label. Use "" (empty string) if not needed'),
  actionHref: z.string().describe('Action button URL. Use "" (empty string) if not needed')
});

const AiListItemComponent = z.object({
  text: z.string().describe('List item text'),
  description: z.string().describe('Description for item. Use "" (empty string) if not needed')
});

const AiListComponent = z.object({
  type: z.literal('List'),
  items: z.array(AiListItemComponent).min(1).max(20).describe('List items'),
  variant: z.enum(['unordered', 'ordered', 'plain']).describe('List style')
});

const AiDividerComponent = z.object({
  type: z.literal('Divider')
});

const AiSpacerComponent = z.object({
  type: z.literal('Spacer'),
  height: z.enum(['16px', '24px', '48px', '72px', '96px']).describe('Spacer height')
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
  right: z.array(AiColumnChild).min(1).max(10).describe('Right column children')
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
  children: z.array(AiSectionContentItem).min(1).max(20).describe('Components inside this section')
});

export type AiSectionComponent = z.infer<typeof AiSectionComponent>;

// ── Top-level UI generation result ─────────────────────────────────

export const AiUiGenerationResultSchema = z.object({
  sections: z.array(AiSectionComponent).min(1).max(10).describe('Page sections, each containing child components'),
  summary: z.string().describe('One-sentence description of the generated UI')
});

export type AiUiGenerationResult = z.infer<typeof AiUiGenerationResultSchema>;

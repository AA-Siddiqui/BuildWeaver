import type { AiComponentStyle, AiSectionChild, AiSectionComponent, AiSectionContentItem, AiUiGenerationResult } from './schemas/ui-generation';

/**
 * Result of transforming AI UI output into the Puck-compatible data format.
 */
export interface TransformedUi {
  /** Puck Data object ready to be loaded into the editor. */
  data: PuckData;
  /** Short summary from the AI describing what was generated. */
  summary: string;
}

/**
 * Minimal Puck Data shape. Kept deliberately lean to avoid importing
 * the @measured/puck dependency which is a frontend-only package.
 */
export interface PuckData {
  root: { id: string; props: Record<string, unknown>; children: unknown[] };
  content: PuckComponent[];
  zones?: Record<string, PuckComponent[]>;
}

export interface PuckComponent {
  type: string;
  props: Record<string, unknown>;
}

type LogFn = (message: string, meta?: Record<string, unknown>) => void;

// ── CSS spacing shorthand parser ──────────────────────────────────
//
// The editor uses separate fields for spacing: `padding` (all sides),
// `paddingX` (left+right), `paddingY` (top+bottom) — same for margin.
// The AI generates standard CSS shorthand (e.g. "48px 64px") which must
// be decomposed into the editor's field model so that axis-specific
// defaults don't override the shorthand values.

/**
 * Result of parsing a CSS spacing shorthand value into the editor's
 * per-axis model.
 */
export interface ParsedSpacing {
  /** Value for all four sides (only set for single-value shorthand). */
  all: string;
  /** Value for left+right (horizontal axis). */
  x: string;
  /** Value for top+bottom (vertical axis). */
  y: string;
}

/**
 * Parses a CSS spacing shorthand value (padding or margin) into the
 * editor's per-axis format.
 *
 * CSS shorthand rules:
 * - 1 value  → all sides equal         → { all: v, x: "", y: "" }
 * - 2 values → vertical horizontal     → { all: "", x: h, y: v }
 * - 3 values → top horizontal bottom   → { all: "", x: h, y: top }
 * - 4 values → top right bottom left   → { all: "", x: right, y: top }
 *
 * For 3/4-value shorthands the editor only supports equal Y (top+bottom)
 * and equal X (left+right), so the conversion is lossy and a warning is
 * logged.
 */
export const parseCssSpacing = (
  value: string,
  log: LogFn
): ParsedSpacing => {
  const trimmed = value.trim();
  if (!trimmed) {
    log('parseCssSpacing: empty value received, returning empty result', { raw: value });
    return { all: '', x: '', y: '' };
  }

  const parts = trimmed.split(/\s+/);

  switch (parts.length) {
    case 1:
      log('parseCssSpacing: single value → all sides', { raw: value, all: parts[0] });
      return { all: parts[0], x: '', y: '' };

    case 2:
      log('parseCssSpacing: two values → Y (vertical) + X (horizontal)', {
        raw: value,
        y: parts[0],
        x: parts[1]
      });
      return { all: '', x: parts[1], y: parts[0] };

    case 3:
      log('parseCssSpacing: three-value shorthand detected; using top for Y, horizontal for X (lossy)', {
        raw: value,
        top: parts[0],
        horizontal: parts[1],
        bottom: parts[2]
      });
      return { all: '', x: parts[1], y: parts[0] };

    case 4:
      log('parseCssSpacing: four-value shorthand detected; using top for Y, right for X (lossy)', {
        raw: value,
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[3]
      });
      return { all: '', x: parts[1], y: parts[0] };

    default:
      log('parseCssSpacing: unexpected format, treating as single value for all sides', { raw: value });
      return { all: trimmed, x: '', y: '' };
  }
};

let idCounter = 0;

const generateId = (prefix: string): string => {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-ai-${idCounter}-${random}`;
};

/**
 * Resets the internal ID counter. For testing purposes only.
 */
export const resetUiTransformerIdCounter = () => {
  idCounter = 0;
};

/**
 * Checks whether a string value is a sentinel empty string (i.e. "not provided").
 * All string fields in the schema are required but use "" as "not provided".
 */
const isEmptyString = (value: string): boolean => value === '';

/**
 * Maps AI style properties to Puck-compatible component prop entries.
 *
 * Sentinel values ("" for strings, "inherit" for enums) are filtered out
 * so only explicitly styled properties appear in the output props.
 *
 * CSS shorthand padding/margin values (e.g. "48px 64px") are decomposed
 * into the editor's per-axis format (padding/paddingX/paddingY) to prevent
 * axis-specific defaults from overriding the intended spacing.
 */
const mapStyleToProps = (
  style: AiComponentStyle,
  log: LogFn
): Record<string, string> => {
  const props: Record<string, string> = {};
  let appliedCount = 0;

  const applyString = (styleKey: keyof AiComponentStyle, propKey: string) => {
    const value = style[styleKey];
    if (typeof value === 'string' && !isEmptyString(value)) {
      props[propKey] = value;
      appliedCount += 1;
    }
  };

  const applyEnum = (styleKey: keyof AiComponentStyle, propKey: string, sentinel: string) => {
    const value = style[styleKey];
    if (typeof value === 'string' && value !== sentinel) {
      props[propKey] = value;
      appliedCount += 1;
    }
  };

  const applySpacing = (styleKey: 'padding' | 'margin', baseProp: string) => {
    const value = style[styleKey];
    if (typeof value !== 'string' || isEmptyString(value)) {
      return;
    }
    const parsed = parseCssSpacing(value, log);
    log('Applying parsed spacing to props', {
      field: baseProp,
      raw: value,
      parsedAll: parsed.all,
      parsedX: parsed.x,
      parsedY: parsed.y
    });

    // Always set all three keys so the stored props override Puck defaults.
    // Empty strings ensure axis defaults ("0px") don't override the shorthand.
    props[baseProp] = parsed.all;
    props[`${baseProp}X`] = parsed.x;
    props[`${baseProp}Y`] = parsed.y;

    // Count only non-empty values as applied for logging
    if (parsed.all) appliedCount += 1;
    if (parsed.x) appliedCount += 1;
    if (parsed.y) appliedCount += 1;
  };

  applyString('textColor', 'textColor');
  applyString('backgroundColor', 'backgroundColor');
  applySpacing('padding', 'padding');
  applySpacing('margin', 'margin');
  applyString('fontSize', 'fontSize');
  applyEnum('fontWeight', 'fontWeight', 'inherit');
  applyEnum('textAlign', 'textAlign', 'inherit');
  applyString('borderRadius', 'borderRadius');
  applyString('borderWidth', 'borderWidth');
  applyString('borderColor', 'borderColor');
  applyString('boxShadow', 'boxShadow');
  applyString('maxWidth', 'maxWidth');
  applyString('opacity', 'opacity');

  if (appliedCount > 0) {
    log('Mapped style properties to component props', {
      appliedCount,
      keys: Object.keys(props).filter((k) => props[k] !== '')
    });
  }

  return props;
};

const transformLeafComponent = (
  child: AiSectionChild,
  log: LogFn
): PuckComponent => {
  const id = generateId(child.type.toLowerCase());
  const styleProps = mapStyleToProps(child.style, log);

  switch (child.type) {
    case 'Heading':
      log('Transforming Heading component', { id, size: child.size, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'Heading',
        props: { id, content: child.content, size: child.size, ...styleProps }
      };

    case 'Paragraph':
      log('Transforming Paragraph component', { id, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'Paragraph',
        props: { id, content: child.content, ...styleProps }
      };

    case 'Button': {
      const hasHref = !isEmptyString(child.href);
      log('Transforming Button component', { id, variant: child.variant, hasHref, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'Button',
        props: {
          id,
          label: child.label,
          variant: child.variant,
          ...(hasHref ? { href: child.href } : {}),
          ...styleProps
        }
      };
    }

    case 'Image':
      log('Transforming Image component', { id, src: child.src, objectFit: child.objectFit, aspectRatio: child.aspectRatio, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'Image',
        props: {
          id,
          src: child.src,
          alt: child.alt,
          objectFit: child.objectFit,
          aspectRatio: child.aspectRatio,
          ...styleProps
        }
      };

    case 'Card': {
      const hasEyebrow = !isEmptyString(child.eyebrow);
      const hasImageUrl = !isEmptyString(child.imageUrl);
      const hasActionLabel = !isEmptyString(child.actionLabel);
      const hasActionHref = !isEmptyString(child.actionHref);
      log('Transforming Card component', { id, hasEyebrow, hasImageUrl, hasActionLabel, hasActionHref, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'Card',
        props: {
          id,
          heading: child.heading,
          content: child.content,
          ...(hasEyebrow ? { eyebrow: child.eyebrow } : {}),
          ...(hasImageUrl ? { imageUrl: child.imageUrl } : {}),
          ...(hasActionLabel ? { actionLabel: child.actionLabel } : {}),
          ...(hasActionHref ? { actionHref: child.actionHref } : {}),
          ...styleProps
        }
      };
    }

    case 'List': {
      log('Transforming List component', { id, itemCount: child.items.length, variant: child.variant, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'List',
        props: {
          id,
          items: child.items.map((item) => ({
            text: item.text,
            ...(!isEmptyString(item.description) ? { description: item.description } : {})
          })),
          variant: child.variant,
          ...styleProps
        }
      };
    }

    case 'Divider':
      log('Transforming Divider component', { id, styleApplied: Object.keys(styleProps).length > 0 });
      return { type: 'Divider', props: { id, ...styleProps } };

    case 'Spacer':
      log('Transforming Spacer component', { id, height: child.height, styleApplied: Object.keys(styleProps).length > 0 });
      return {
        type: 'Spacer',
        props: { id, height: child.height, ...styleProps }
      };
  }
};

const transformSectionContentItem = (
  item: AiSectionContentItem,
  sectionId: string,
  zones: Record<string, PuckComponent[]>,
  log: LogFn
): PuckComponent => {
  if (item.type === 'Columns') {
    const columnsId = generateId('columns');
    const styleProps = mapStyleToProps(item.style, log);
    log('Transforming Columns component', {
      id: columnsId,
      layout: item.layout,
      leftCount: item.left.length,
      rightCount: item.right.length,
      styleApplied: Object.keys(styleProps).length > 0
    });

    const leftChildren = item.left.map((child) => transformLeafComponent(child, log));
    const rightChildren = item.right.map((child) => transformLeafComponent(child, log));

    zones[`${columnsId}:left`] = leftChildren;
    zones[`${columnsId}:right`] = rightChildren;

    return {
      type: 'Columns',
      props: { id: columnsId, layout: item.layout, ...styleProps }
    };
  }

  return transformLeafComponent(item, log);
};

const transformSection = (
  section: AiSectionComponent,
  zones: Record<string, PuckComponent[]>,
  log: LogFn
): PuckComponent => {
  const sectionId = generateId('section');
  const styleProps = mapStyleToProps(section.style, log);
  log('Transforming Section', {
    id: sectionId,
    backgroundColor: section.backgroundColor,
    childCount: section.children.length,
    styleApplied: Object.keys(styleProps).length > 0,
    styleKeys: Object.keys(styleProps).filter((k) => styleProps[k] !== '')
  });

  const sectionChildren = section.children.map((item) =>
    transformSectionContentItem(item, sectionId, zones, log)
  );

  zones[`${sectionId}:contentSlot`] = sectionChildren;

  return {
    type: 'Section',
    props: {
      id: sectionId,
      minHeight: '0',
      padding: '0px',
      paddingX: '0px',
      paddingY: '0px',
      margin: '0px',
      marginX: '0px',
      marginY: '0px',
      borderWidth: '',
      borderColor: '',
      // Style props override the hardcoded defaults above.
      // parseCssSpacing ensures padding/margin shorthand values are
      // decomposed into per-axis props (paddingX/paddingY etc.) so the
      // editor applies them correctly.
      ...styleProps,
      // Section's dedicated backgroundColor always takes priority
      backgroundColor: section.backgroundColor
    }
  };
};

/**
 * Transforms an AI UI generation result into a Puck-compatible Data object.
 *
 * The AI output uses a simplified component tree. This function converts it
 * to Puck's flat content array + zones format where child components of
 * containers (Section, Columns) are stored in the zones map keyed by
 * `parentId:slotName`.
 *
 * Empty-string sentinel values from the schema are stripped so they don't
 * appear as props on the resulting Puck components.
 *
 * Style properties from each component's `style` object are flattened into
 * top-level props on the Puck component, matching the editor's style field keys.
 *
 * CSS shorthand padding/margin values are automatically decomposed into the
 * editor's per-axis model (padding/paddingX/paddingY) via {@link parseCssSpacing}.
 */
export function transformAiUiOutput(
  aiResult: AiUiGenerationResult,
  logger?: LogFn
): TransformedUi {
  const log: LogFn = logger ?? (() => {});

  log('Starting UI transformation', {
    sectionCount: aiResult.sections.length,
    summary: aiResult.summary
  });

  resetUiTransformerIdCounter();

  const zones: Record<string, PuckComponent[]> = {};
  const content: PuckComponent[] = [];

  for (const section of aiResult.sections) {
    const sectionComponent = transformSection(section, zones, log);
    content.push(sectionComponent);
  }

  log('UI transformation complete', {
    contentItems: content.length,
    zoneCount: Object.keys(zones).length,
    totalZoneChildren: Object.values(zones).reduce((acc, z) => acc + z.length, 0)
  });

  return {
    data: {
      root: { id: 'root', props: {}, children: [] },
      content,
      zones
    },
    summary: aiResult.summary
  };
}

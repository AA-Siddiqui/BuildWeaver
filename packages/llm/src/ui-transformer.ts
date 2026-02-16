import type { AiSectionChild, AiSectionComponent, AiSectionContentItem, AiUiGenerationResult } from './schemas/ui-generation';

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

const transformLeafComponent = (
  child: AiSectionChild,
  log: LogFn
): PuckComponent => {
  const id = generateId(child.type.toLowerCase());

  switch (child.type) {
    case 'Heading':
      log('Transforming Heading component', { id, size: child.size });
      return {
        type: 'Heading',
        props: { id, content: child.content, size: child.size }
      };

    case 'Paragraph':
      log('Transforming Paragraph component', { id });
      return {
        type: 'Paragraph',
        props: { id, content: child.content }
      };

    case 'Button': {
      const hasHref = !isEmptyString(child.href);
      log('Transforming Button component', { id, variant: child.variant, hasHref });
      return {
        type: 'Button',
        props: {
          id,
          label: child.label,
          variant: child.variant,
          ...(hasHref ? { href: child.href } : {})
        }
      };
    }

    case 'Image':
      log('Transforming Image component', { id, src: child.src, objectFit: child.objectFit, aspectRatio: child.aspectRatio });
      return {
        type: 'Image',
        props: {
          id,
          src: child.src,
          alt: child.alt,
          objectFit: child.objectFit,
          aspectRatio: child.aspectRatio
        }
      };

    case 'Card': {
      const hasEyebrow = !isEmptyString(child.eyebrow);
      const hasImageUrl = !isEmptyString(child.imageUrl);
      const hasActionLabel = !isEmptyString(child.actionLabel);
      const hasActionHref = !isEmptyString(child.actionHref);
      log('Transforming Card component', { id, hasEyebrow, hasImageUrl, hasActionLabel, hasActionHref });
      return {
        type: 'Card',
        props: {
          id,
          heading: child.heading,
          content: child.content,
          ...(hasEyebrow ? { eyebrow: child.eyebrow } : {}),
          ...(hasImageUrl ? { imageUrl: child.imageUrl } : {}),
          ...(hasActionLabel ? { actionLabel: child.actionLabel } : {}),
          ...(hasActionHref ? { actionHref: child.actionHref } : {})
        }
      };
    }

    case 'List': {
      log('Transforming List component', { id, itemCount: child.items.length, variant: child.variant });
      return {
        type: 'List',
        props: {
          id,
          items: child.items.map((item) => ({
            text: item.text,
            ...(!isEmptyString(item.description) ? { description: item.description } : {})
          })),
          variant: child.variant
        }
      };
    }

    case 'Divider':
      log('Transforming Divider component', { id });
      return { type: 'Divider', props: { id } };

    case 'Spacer':
      log('Transforming Spacer component', { id, height: child.height });
      return {
        type: 'Spacer',
        props: { id, height: child.height }
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
    log('Transforming Columns component', {
      id: columnsId,
      layout: item.layout,
      leftCount: item.left.length,
      rightCount: item.right.length
    });

    const leftChildren = item.left.map((child) => transformLeafComponent(child, log));
    const rightChildren = item.right.map((child) => transformLeafComponent(child, log));

    zones[`${columnsId}:left`] = leftChildren;
    zones[`${columnsId}:right`] = rightChildren;

    return {
      type: 'Columns',
      props: { id: columnsId, layout: item.layout }
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
  log('Transforming Section', {
    id: sectionId,
    backgroundColor: section.backgroundColor,
    childCount: section.children.length
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

import type { PuckComponentData, PuckData } from './types';

const LOG_PREFIX = '[Codegen:SlotNormalizer]';

/**
 * Known slot field names per component type.
 * These map component types to the prop keys that contain inline slot children
 * when using Puck v0.16+ slot field API.
 */
const COMPONENT_SLOT_FIELDS: Record<string, string[]> = {
  Section: ['contentSlot'],
  Columns: ['left', 'right'],
  List: ['customItemSlot']
};

/**
 * Checks if a prop value looks like an inline slot array (array of PuckComponentData).
 */
const isInlineSlotArray = (value: unknown): value is PuckComponentData[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.type === 'string' &&
      item.props !== null &&
      typeof item.props === 'object'
  );
};

/**
 * Extracts inline slot data from a single component's props and adds entries
 * to the zones map. Also recurses into children found in the slots.
 */
const extractSlotsFromComponent = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>
): void => {
  const componentId = component.props.id as string | undefined;
  if (!componentId) {
    console.warn(`${LOG_PREFIX} Component type="${component.type}" has no id, skipping slot extraction`);
    return;
  }

  const componentType = component.type;

  // Handle known slot fields
  const knownSlots = COMPONENT_SLOT_FIELDS[componentType];
  if (knownSlots) {
    for (const slotName of knownSlots) {
      const slotValue = component.props[slotName];
      if (isInlineSlotArray(slotValue)) {
        const zoneKey = `${componentId}:${slotName}`;
        if (!zones[zoneKey]) {
          zones[zoneKey] = slotValue;
          console.info(
            `${LOG_PREFIX} Extracted inline slot "${slotName}" from ${componentType} id="${componentId}" -> zone "${zoneKey}" (${slotValue.length} children)`
          );
        }
        // Recurse into the slot children
        for (const child of slotValue) {
          extractSlotsFromComponent(child, zones);
        }
      }
    }
  }

  // Handle Conditional component: cases array with nested slots
  if (componentType === 'Conditional') {
    const cases = component.props.cases;
    if (Array.isArray(cases)) {
      for (let i = 0; i < cases.length; i++) {
        const caseItem = cases[i] as Record<string, unknown> | undefined;
        if (!caseItem) continue;
        const slotValue = caseItem.slot;
        if (isInlineSlotArray(slotValue)) {
          const zoneKey = `${componentId}:cases-${i}-slot`;
          if (!zones[zoneKey]) {
            zones[zoneKey] = slotValue;
            console.info(
              `${LOG_PREFIX} Extracted inline slot "cases-${i}-slot" from Conditional id="${componentId}" -> zone "${zoneKey}" (${slotValue.length} children)`
            );
          }
          for (const child of slotValue) {
            extractSlotsFromComponent(child, zones);
          }
        }
      }
    }
  }

  // Generic fallback: detect any prop that looks like an inline slot array
  // for component types not in the known map (future-proofing)
  if (!knownSlots && componentType !== 'Conditional') {
    for (const [propKey, propValue] of Object.entries(component.props)) {
      if (propKey === 'id' || propKey === 'customCss') continue;
      if (isInlineSlotArray(propValue)) {
        const zoneKey = `${componentId}:${propKey}`;
        if (!zones[zoneKey]) {
          zones[zoneKey] = propValue;
          console.info(
            `${LOG_PREFIX} Extracted unknown inline slot "${propKey}" from ${componentType} id="${componentId}" -> zone "${zoneKey}" (${propValue.length} children)`
          );
        }
        for (const child of propValue) {
          extractSlotsFromComponent(child, zones);
        }
      }
    }
  }
};

/**
 * Normalizes PuckData so that inline slot children (stored in component props
 * by Puck v0.16+ slot field API) are extracted into the top-level `zones` map.
 *
 * This ensures compatibility with the component emitter's `getZoneChildren()`
 * which looks up slot children via `zones["componentId:slotName"]`.
 *
 * The function is idempotent: if zones are already populated (from the older
 * DropZone API), existing entries are preserved.
 */
export const normalizePuckSlots = (puckData: PuckData): PuckData => {
  if (!puckData.content || puckData.content.length === 0) {
    console.info(`${LOG_PREFIX} No content to normalize`);
    return puckData;
  }

  const zones: Record<string, PuckComponentData[]> = { ...(puckData.zones ?? {}) };
  const zoneCountBefore = Object.keys(zones).length;

  for (const component of puckData.content) {
    extractSlotsFromComponent(component, zones);
  }

  const zoneCountAfter = Object.keys(zones).length;
  const extracted = zoneCountAfter - zoneCountBefore;

  if (extracted > 0) {
    console.info(
      `${LOG_PREFIX} Slot normalization complete: ${extracted} new zone(s) extracted (total: ${zoneCountAfter})`
    );
  } else {
    console.info(`${LOG_PREFIX} Slot normalization complete: no inline slots found`);
  }

  return {
    ...puckData,
    zones
  };
};

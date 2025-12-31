import { useEffect, useMemo, useState } from 'react';
import type { CustomField, FieldProps } from '@measured/puck';
import { usePuck } from '@measured/puck';
import type { ComponentData } from '@measured/puck';
import { useComponentLibrary } from './component-library-context';
import {
  collectDynamicBindings,
  findComponentById,
  normalizeComponentDefinition,
  COMPONENT_ACTIONS_FIELD_KEY,
  buildBindingSignature,
  resolveComponentRootId,
  isSlotBindingReference
} from './component-library';
import { PropertyFilterGuard } from './property-search';
import { ENABLE_SLOT_PARAMETERS, logFeatureFlagEvent } from './feature-flags';
import { ComponentBindingReference } from '@buildweaver/libs';

const formatBindingLabel = (label?: string, propertyPath?: string[]) => {
  if (!propertyPath || !propertyPath.length) {
    return label ?? 'Dynamic data';
  }
  return `${label ?? 'Dynamic data'} → ${propertyPath.join('.')}`;
};

const usePuckStore = () => {
  try {
    return usePuck();
  } catch {
    return undefined;
  }
};

export const ComponentActionsField = ({ readOnly }: FieldProps<CustomField<null>, null>) => {
  const puckStore = usePuckStore();
  const { builderState, bindingOptions, componentLibrary, saveComponent, isSavingComponent, log } = useComponentLibrary();
  const selectedId = (puckStore?.selectedItem?.props as { id?: string } | undefined)?.id ?? '';
  const selectedComponent = useMemo<ComponentData | undefined>(
    () => findComponentById(builderState, selectedId),
    [builderState, selectedId]
  );
  const normalizedDefinition = useMemo(
    () => normalizeComponentDefinition(selectedComponent),
    [selectedComponent]
  );
  const selectedRootId = useMemo(() => resolveComponentRootId(selectedComponent), [selectedComponent]);
  const [componentName, setComponentName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [parameterizedBindings, setParameterizedBindings] = useState<Set<string>>(new Set());

  const bindingLookup = useMemo(
    () => new Map(bindingOptions.map((option) => [option.value, option.label])),
    [bindingOptions]
  );
  
  const dynamicBindings = useMemo(() => collectDynamicBindings(selectedComponent).filter((binding: ComponentBindingReference) => {
    const isSlot = isSlotBindingReference(binding, selectedRootId);
    const slotDisabled = isSlot && !ENABLE_SLOT_PARAMETERS;
    return !slotDisabled;
  }), [selectedComponent]); // LATER: May need selectedRootId here, check later

  useEffect(() => {
    const initial = new Set<string>();
    dynamicBindings.forEach((binding) => {
      const signature = buildBindingSignature(binding);
      const isSlot = isSlotBindingReference(binding, selectedRootId);
      if (isSlot && !ENABLE_SLOT_PARAMETERS && binding.exposeAsParameter) {
        log?.('Slot parameter stripped due to flag', { signature, selectedRootId });
        return;
      }
      if (binding.exposeAsParameter) {
        initial.add(signature);
      }
    });
    setParameterizedBindings(initial);
  }, [dynamicBindings, log, selectedRootId]);

  const handleSave = async () => {
    if (readOnly) {
      return;
    }
    if (!selectedId || !normalizedDefinition) {
      setFeedback('Select an element to save as a component.');
      return;
    }
    const desiredName = (componentName || selectedComponent?.type || 'Component').trim();
    if (!desiredName) {
      setFeedback('Enter a component name.');
      return;
    }
    const duplicate = componentLibrary.some((entry) => entry.name.toLowerCase() === desiredName.toLowerCase());
    if (duplicate) {
      setFeedback('A component with this name already exists in this project.');
      return;
    }
    setFeedback('');
    log?.('Saving component from selection', {
      targetId: selectedId,
      name: desiredName,
      bindings: dynamicBindings.length,
      parameters: parameterizedBindings.size
    });
    try {
      await saveComponent({
        name: desiredName,
        targetId: selectedId,
        definition: normalizedDefinition,
        bindingReferences: dynamicBindings.map((binding) => ({
          ...binding,
          exposeAsParameter: (() => {
            const signature = buildBindingSignature(binding);
            const isSlot = isSlotBindingReference(binding, selectedRootId);
            const desired = parameterizedBindings.has(signature);
            if (isSlot && !ENABLE_SLOT_PARAMETERS) {
              log?.('Slot parameter blocked by feature flag', { signature, selectedRootId });
              return false;
            }
            return desired;
          })()
        }))
      });
      setFeedback('Component saved to library.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to save component');
    }
  };

  return (
    <PropertyFilterGuard fieldKey={COMPONENT_ACTIONS_FIELD_KEY} label="Component actions" keywords={[selectedComponent?.type ?? 'component']}>
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">Component</p>
            <p className="text-sm font-semibold text-gray-900">
              {selectedComponent?.type ?? 'Select an element'}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[0.65rem] text-gray-700">
            {dynamicBindings.length} dynamic {dynamicBindings.length === 1 ? 'binding' : 'bindings'}
          </span>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700" htmlFor="component-name-input">
            Component name
          </label>
          <input
            id="component-name-input"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
            placeholder={selectedComponent?.type ?? 'PricingCard'}
            value={componentName}
            onChange={(event) => setComponentName(event.target.value)}
            disabled={readOnly || isSavingComponent || !selectedComponent}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={readOnly || isSavingComponent || !selectedComponent || !normalizedDefinition}
            className="w-full rounded-lg bg-bw-sand px-3 py-2 text-sm font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingComponent ? 'Saving…' : 'Make component'}
          </button>
          {feedback ? <p className="text-xs text-gray-600" role="status">{feedback}</p> : null}
        </div>
        <div className="space-y-2">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">Dynamic data</p>
          {dynamicBindings.length === 0 ? (
            <p className="text-xs text-gray-600">No dynamic data detected in this selection.</p>
          ) : (
            <ul className="space-y-2 text-xs text-gray-800">
              {dynamicBindings.map((binding) => {
                const label = bindingLookup.get(binding.bindingId) ?? binding.bindingId;
                const display = formatBindingLabel(label, binding.propertyPath);
                const key = buildBindingSignature(binding);
                const checked = parameterizedBindings.has(key);
                const isSlot = isSlotBindingReference(binding, selectedRootId);
                const slotDisabled = isSlot && !ENABLE_SLOT_PARAMETERS;
                if (slotDisabled) {
                  logFeatureFlagEvent('Slot parameter toggle disabled in save panel', {
                    signature: key,
                    selectedRootId
                  });
                }
                return (
                  <li key={key} className="flex items-start justify-between gap-2 rounded-md border border-gray-100 px-2 py-1.5">
                    <span>• {display}</span>
                    <label className="flex items-center gap-1 text-[0.68rem] font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-bw-amber focus:ring-bw-amber"
                        checked={checked}
                        onChange={(event) => {
                          setParameterizedBindings((current) => {
                            const next = new Set(current);
                            if (event.target.checked) {
                              next.add(key);
                            } else {
                              next.delete(key);
                            }
                            return next;
                          });
                        }}
                        disabled={readOnly || isSavingComponent || slotDisabled}
                        aria-label="Expose as component parameter"
                      />
                      {slotDisabled ? 'Slot parameters disabled' : 'Make parameter'}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PropertyFilterGuard>
  );
};

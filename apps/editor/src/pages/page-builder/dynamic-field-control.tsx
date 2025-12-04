import type { CustomField, Field, FieldProps } from '@measured/puck';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useMemo } from 'react';
import {
  BindingOption,
  DynamicBindingState,
  DynamicBindingValue,
  createDynamicBindingState,
  getBindableOptions,
  getStaticFallbackValue,
  isDynamicBindingValue,
  logDynamicFieldEvent,
  sanitizePropertyPath
} from './dynamic-binding';
import { PropertyFilterGuard } from './property-search';
import type { PageDynamicInputDataType, PageDynamicListItemType, ScalarValue } from '@buildweaver/libs';

const VARIABLE_ICON = '{ }';

const MAX_PROPERTY_DEPTH = 4;

const isObjectValue = (value: ScalarValue | undefined): value is Record<string, ScalarValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getObjectSource = (option?: BindingOption): Record<string, ScalarValue> | undefined => {
  if (!option) {
    return undefined;
  }
  if (isObjectValue(option.previewValue)) {
    return option.previewValue;
  }
  if (isObjectValue(option.objectSample)) {
    return option.objectSample;
  }
  return undefined;
};

const getListObjectSource = (option?: BindingOption): Record<string, ScalarValue> | undefined => {
  if (!option || option.listItemType !== 'object') {
    return undefined;
  }
  if (option.listObjectSample && isObjectValue(option.listObjectSample)) {
    return option.listObjectSample;
  }
  if (Array.isArray(option.previewValue)) {
    const firstObject = option.previewValue.find((entry) => isObjectValue(entry as ScalarValue));
    if (firstObject && isObjectValue(firstObject)) {
      return firstObject as Record<string, ScalarValue>;
    }
  }
  return undefined;
};

const isValidListIndex = (value?: string): value is string => typeof value === 'string' && /^\d+$/.test(value);

const sanitizeListIndex = (value: string): string => value.replace(/[^0-9]/g, '');

type PropertyLevel = {
  depth: number;
  options: string[];
  selected?: string;
};

type ListBindingMode = 'collection' | 'element';

const buildPropertyLevels = (source: Record<string, ScalarValue> | undefined, path: string[]): PropertyLevel[] => {
  const levels: PropertyLevel[] = [];
  let current: Record<string, ScalarValue> | undefined = source;
  for (let depth = 0; depth < MAX_PROPERTY_DEPTH; depth += 1) {
    if (!current) {
      break;
    }
    const keys = Object.keys(current).sort();
    if (!keys.length) {
      break;
    }
    const desired = path[depth];
    const selected = desired && keys.includes(desired) ? desired : '';
    levels.push({ depth, options: keys, selected });
    if (!selected) {
      break;
    }
    const nextValue = current[selected];
    current = isObjectValue(nextValue) ? (nextValue as Record<string, ScalarValue>) : undefined;
  }
  return levels;
};

const deriveDefaultPropertyPath = (source: Record<string, ScalarValue> | undefined): string[] | undefined => {
  if (!source) {
    return undefined;
  }
  const [firstKey] = Object.keys(source);
  if (!firstKey) {
    return undefined;
  }
  return [firstKey];
};

const normalizePropertyPathForSource = (
  source: Record<string, ScalarValue> | undefined,
  path?: string[]
): string[] | undefined => {
  const sanitized = sanitizePropertyPath(path);
  if (!sanitized) {
    return undefined;
  }
  const nextPath: string[] = [];
  let current: Record<string, ScalarValue> | undefined = source;
  for (let depth = 0; depth < sanitized.length && depth < MAX_PROPERTY_DEPTH; depth += 1) {
    const segment = sanitized[depth];
    if (!current || !Object.prototype.hasOwnProperty.call(current, segment)) {
      break;
    }
    nextPath.push(segment);
    const value = current[segment];
    current = isObjectValue(value) ? (value as Record<string, ScalarValue>) : undefined;
  }
  return nextPath.length ? nextPath : undefined;
};

const propertyPathsEqual = (left?: string[], right?: string[]): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((segment, index) => segment === right[index]);
};

export type StaticControlRendererProps = {
  inputId: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (next: string) => void;
  isFallback: boolean;
  field?: Field;
};

type LabelActionProps = {
  isDynamic: boolean;
  value: string;
  readOnly?: boolean;
};

export type DynamicFieldControlProps = FieldProps<CustomField<DynamicBindingValue>, DynamicBindingValue> & {
  fieldKey: string;
  bindingOptions: BindingOption[];
  renderStaticControl: (props: StaticControlRendererProps) => ReactNode;
  placeholder?: string;
  bindingLabel?: string;
  labelActions?: (props: LabelActionProps) => ReactNode;
  helperText?: string;
  allowedDataTypes?: PageDynamicInputDataType[];
};

export const DynamicFieldControl = ({
  field,
  id,
  value,
  onChange,
  readOnly,
  fieldKey,
  bindingOptions,
  placeholder,
  bindingLabel = 'Dynamic source',
  renderStaticControl,
  labelActions,
  helperText,
  allowedDataTypes
}: DynamicFieldControlProps) => {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const fallbackInputId = `${resolvedId}-fallback`;
  const bindingSelectId = `${resolvedId}-binding`;
  const optionMap = useMemo(() => new Map(bindingOptions.map((option) => [option.value, option])), [bindingOptions]);
  const allowedTypes = allowedDataTypes?.filter(Boolean);
  const filteredOptions = useMemo(() => {
    if (!allowedTypes?.length) {
      return bindingOptions;
    }
    return bindingOptions.filter((option) => {
      if (!option.value || !option.dataType) {
        return true;
      }
      return allowedTypes.includes(option.dataType);
    });
  }, [allowedTypes, bindingOptions]);
  const rawDynamicChoices = useMemo(() => getBindableOptions(filteredOptions), [filteredOptions]);
  const isDynamic = isDynamicBindingValue(value);
  const dynamicState = isDynamic ? (value as DynamicBindingState) : undefined;
  const staticValue = getStaticFallbackValue(value);
  const currentBindingId = dynamicState?.bindingId ?? '';
  const selectedOption = optionMap.get(currentBindingId);
  const bindingRestricted = Boolean(
    isDynamic &&
      allowedTypes?.length &&
      (!selectedOption?.dataType || !allowedTypes.includes(selectedOption.dataType))
  );
  const dynamicChoices = useMemo(() => {
    if (
      bindingRestricted &&
      selectedOption &&
      !rawDynamicChoices.some((option) => option.value === selectedOption.value)
    ) {
      return [selectedOption, ...rawDynamicChoices];
    }
    return rawDynamicChoices;
  }, [bindingRestricted, rawDynamicChoices, selectedOption]);
  const isListOption = selectedOption?.dataType === 'list';
  const listItemType = selectedOption?.listItemType as PageDynamicListItemType | undefined;
  const isListOfObjects = isListOption && listItemType === 'object';
  const objectPropertySource = useMemo(
    () => (selectedOption?.dataType === 'object' ? getObjectSource(selectedOption) : undefined),
    [selectedOption]
  );
  const listPropertySource = useMemo(
    () => (isListOfObjects ? getListObjectSource(selectedOption) : undefined),
    [isListOfObjects, selectedOption]
  );
  const propertySource = isListOfObjects ? listPropertySource : objectPropertySource;
  const fullPropertyPathSignature = dynamicState ? JSON.stringify(dynamicState.propertyPath ?? []) : '';
  const normalizedFullPath = useMemo(
    () => (dynamicState ? sanitizePropertyPath(dynamicState.propertyPath) ?? [] : []),
    [dynamicState, fullPropertyPathSignature]
  );
  const listIndexSegment =
    isListOption && normalizedFullPath.length && isValidListIndex(normalizedFullPath[0])
      ? normalizedFullPath[0]
      : '';
  const elementPropertyPath = isListOption && listIndexSegment ? normalizedFullPath.slice(1) : normalizedFullPath;
  const listBindingMode: ListBindingMode = isListOption && listIndexSegment ? 'element' : 'collection';
  const effectivePropertyPath = isListOfObjects ? elementPropertyPath : normalizedFullPath;
  const effectivePropertyPathSignature = JSON.stringify(effectivePropertyPath);
  const propertyLevels = useMemo(
    () => buildPropertyLevels(propertySource, effectivePropertyPath),
    [propertySource, effectivePropertyPathSignature]
  );
  const displayPropertyPath = useMemo(() => {
    if (!isListOption || listBindingMode !== 'element') {
      return effectivePropertyPath;
    }
    if (isValidListIndex(listIndexSegment)) {
      return [listIndexSegment, ...effectivePropertyPath];
    }
    return effectivePropertyPath;
  }, [effectivePropertyPath, isListOption, listBindingMode, listIndexSegment]);
  const shouldShowPropertySelector = Boolean(
    isDynamic &&
      (selectedOption?.dataType === 'object' || (isListOfObjects && listBindingMode === 'element'))
  );
  const hasDynamicChoices = dynamicChoices.length > 0;
  const dynamicButtonDisabled = readOnly || !hasDynamicChoices;

  useEffect(() => {
    if (!isDynamic || !hasDynamicChoices || readOnly) {
      return;
    }
    if (currentBindingId) {
      if (dynamicChoices.some((option) => option.value === currentBindingId)) {
        return;
      }
      logDynamicFieldEvent('Dynamic binding restricted awaiting user action', {
        fieldKey,
        bindingId: currentBindingId
      });
      return;
    }
    const fallbackBindingId = dynamicChoices[0]?.value;
    if (!fallbackBindingId) {
      return;
    }
    logDynamicFieldEvent('Dynamic binding defaulted', { fieldKey, bindingId: fallbackBindingId });
    onChange(createDynamicBindingState(fallbackBindingId, staticValue));
  }, [currentBindingId, dynamicChoices, fieldKey, hasDynamicChoices, isDynamic, onChange, readOnly, staticValue]);

  useEffect(() => {
    if (!shouldShowPropertySelector || !currentBindingId) {
      return;
    }
    const normalized = normalizePropertyPathForSource(propertySource, effectivePropertyPath);
    let nextTail = normalized;
    if ((!nextTail || !nextTail.length) && propertySource) {
      nextTail = deriveDefaultPropertyPath(propertySource);
    }
    const prefixSegments =
      isListOption && listBindingMode === 'element'
        ? [isValidListIndex(listIndexSegment) ? listIndexSegment : '0']
        : [];
    const mergedPath = prefixSegments.length ? [...prefixSegments, ...(nextTail ?? [])] : nextTail ?? [];
    if (!propertyPathsEqual(mergedPath, dynamicState?.propertyPath)) {
      logDynamicFieldEvent('Object binding path synchronized', {
        fieldKey,
        bindingId: currentBindingId,
        nextPath: mergedPath
      });
      onChange(createDynamicBindingState(currentBindingId, staticValue, mergedPath.length ? mergedPath : undefined));
    }
  }, [
    currentBindingId,
    dynamicState?.propertyPath,
    effectivePropertyPath,
    isListOption,
    listBindingMode,
    listIndexSegment,
    onChange,
    propertySource,
    shouldShowPropertySelector,
    staticValue,
    fieldKey
  ]);

  const handleToggleMode = () => {
    if (dynamicButtonDisabled) {
      logDynamicFieldEvent('Dynamic binding toggle blocked', { fieldKey, reason: 'disabled' });
      return;
    }
    if (isDynamic) {
      logDynamicFieldEvent('Dynamic binding removed', { fieldKey });
      onChange(staticValue);
      return;
    }
    const nextBinding = currentBindingId || dynamicChoices[0]?.value;
    if (!nextBinding) {
      logDynamicFieldEvent('Dynamic binding toggle blocked', { fieldKey, reason: 'no-options' });
      return;
    }
    logDynamicFieldEvent('Dynamic binding enabled', { fieldKey, bindingId: nextBinding });
    onChange(createDynamicBindingState(nextBinding, staticValue));
  };

  const handleBindingChange = (nextId: string) => {
    if (!isDynamic) {
      return;
    }
    if (nextId === currentBindingId) {
      return;
    }
    logDynamicFieldEvent('Dynamic source updated', { fieldKey, bindingId: nextId });
    onChange(createDynamicBindingState(nextId, staticValue));
  };

  const handlePropertyPathSelect = useCallback(
    (depth: number, segment: string) => {
      if (!isDynamic || !currentBindingId) {
        return;
      }
      const basePath = isListOfObjects ? elementPropertyPath : normalizedFullPath;
      const trimmedPath = basePath.slice(0, depth);
      const nextTail = segment ? [...trimmedPath, segment] : trimmedPath;
      const prefix =
        isListOption && listBindingMode === 'element'
          ? [isValidListIndex(listIndexSegment) ? listIndexSegment : '0']
          : [];
      const nextPath = prefix.length ? [...prefix, ...nextTail] : nextTail;
      logDynamicFieldEvent('Object property segment selected', {
        fieldKey,
        bindingId: currentBindingId,
        depth,
        nextPath
      });
      onChange(createDynamicBindingState(currentBindingId, staticValue, nextPath));
    },
    [
      currentBindingId,
      elementPropertyPath,
      fieldKey,
      isDynamic,
      isListOption,
      isListOfObjects,
      listBindingMode,
      listIndexSegment,
      normalizedFullPath,
      onChange,
      staticValue
    ]
  );

  const handleListModeChange = useCallback(
    (mode: ListBindingMode) => {
      if (!isDynamic || !isListOption || !currentBindingId) {
        return;
      }
      if (mode === 'collection') {
        const nextPath = isListOfObjects ? elementPropertyPath : [];
        logDynamicFieldEvent('List binding switched to collection', {
          fieldKey,
          bindingId: currentBindingId
        });
        onChange(createDynamicBindingState(currentBindingId, staticValue, nextPath.length ? nextPath : undefined));
        return;
      }
      const nextIndex = isValidListIndex(listIndexSegment) ? listIndexSegment : '0';
      const tail = isListOfObjects ? elementPropertyPath : [];
      logDynamicFieldEvent('List binding switched to element mode', {
        fieldKey,
        bindingId: currentBindingId,
        index: nextIndex
      });
      onChange(createDynamicBindingState(currentBindingId, staticValue, [nextIndex, ...tail]));
    },
    [
      currentBindingId,
      elementPropertyPath,
      fieldKey,
      isDynamic,
      isListOption,
      isListOfObjects,
      listIndexSegment,
      onChange,
      staticValue
    ]
  );

  const handleListIndexChange = useCallback(
    (nextValue: string) => {
      if (!isDynamic || !isListOption || !currentBindingId) {
        return;
      }
      const normalizedIndex = sanitizeListIndex(nextValue);
      if (!normalizedIndex) {
        const tail = isListOfObjects ? elementPropertyPath : [];
        logDynamicFieldEvent('List binding index cleared', {
          fieldKey,
          bindingId: currentBindingId
        });
        onChange(createDynamicBindingState(currentBindingId, staticValue, tail.length ? tail : undefined));
        return;
      }
      const tail = isListOfObjects ? elementPropertyPath : [];
      logDynamicFieldEvent('List binding index updated', {
        fieldKey,
        bindingId: currentBindingId,
        index: normalizedIndex
      });
      onChange(createDynamicBindingState(currentBindingId, staticValue, [normalizedIndex, ...tail]));
    },
    [
      currentBindingId,
      elementPropertyPath,
      fieldKey,
      isDynamic,
      isListOption,
      isListOfObjects,
      onChange,
      staticValue
    ]
  );

  const handleStaticValueChange = (next: string) => {
    if (isDynamic) {
      const bindingId = currentBindingId || dynamicChoices[0]?.value;
      onChange(createDynamicBindingState(bindingId ?? '', next));
      return;
    }
    onChange(next);
  };

  const staticControl = renderStaticControl({
    inputId: isDynamic ? fallbackInputId : resolvedId,
    placeholder,
    readOnly,
    value: staticValue,
    onChange: handleStaticValueChange,
    isFallback: isDynamic,
    field
  });

  const toggleTitle = dynamicButtonDisabled
    ? 'Add dynamic inputs in the left sidebar to enable bindings'
    : isDynamic
      ? 'Disable dynamic binding'
      : 'Bind this field to a dynamic input';

  return (
    <PropertyFilterGuard fieldKey={fieldKey} label={field.label ?? fieldKey}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
          <label htmlFor={isDynamic ? fallbackInputId : resolvedId}>{field.label ?? 'Field'}</label>
          <div className="flex items-center gap-1">
            {labelActions?.({ isDynamic, value: staticValue, readOnly })}
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-[0.65rem] font-semibold ${isDynamic ? 'border-bw-amber text-bw-amber' : 'border-gray-300 text-gray-500'} ${dynamicButtonDisabled ? 'cursor-not-allowed opacity-60' : 'hover:border-bw-amber hover:text-bw-amber'}`}
              onClick={handleToggleMode}
              title={toggleTitle}
              aria-pressed={isDynamic}
              disabled={dynamicButtonDisabled}
            >
              <span aria-hidden="true">{VARIABLE_ICON}</span>
              <span className="sr-only">Toggle dynamic binding</span>
            </button>
          </div>
        </div>
        {isDynamic ? (
          <>
            <div className="space-y-1">
              <label htmlFor={bindingSelectId} className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">
                {bindingLabel}
              </label>
              <select
                id={bindingSelectId}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
                value={currentBindingId || dynamicChoices[0]?.value || ''}
                onChange={(event) => handleBindingChange(event.target.value)}
                disabled={!hasDynamicChoices || readOnly}
              >
                {dynamicChoices.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!hasDynamicChoices ? (
                <p className="text-xs text-gray-500">Add dynamic inputs to bind this field.</p>
              ) : null}
              {bindingRestricted ? (
                <p className="text-[0.65rem] text-amber-600">
                  This field expects {allowedTypes?.join(', ') ?? 'specific'} data. Choose a compatible input or switch back to static mode.
                </p>
              ) : null}
            </div>
            {isListOption ? (
              <div className="space-y-2 rounded-lg border border-gray-200/80 bg-gray-50/60 p-3">
                <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">List binding</p>
                <div className="flex flex-col gap-1 text-xs text-gray-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${bindingSelectId}-list-mode`}
                      value="collection"
                      checked={listBindingMode === 'collection'}
                      onChange={() => handleListModeChange('collection')}
                      disabled={readOnly}
                    />
                    <span>Use entire list</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${bindingSelectId}-list-mode`}
                      value="element"
                      checked={listBindingMode === 'element'}
                      onChange={() => handleListModeChange('element')}
                      disabled={readOnly}
                    />
                    <span>Display a specific item</span>
                  </label>
                </div>
                {listBindingMode === 'element' ? (
                  <label className="block text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">
                    Item index
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
                      value={listIndexSegment}
                      onChange={(event) => handleListIndexChange(event.target.value)}
                      disabled={readOnly}
                    />
                  </label>
                ) : null}
                {isListOfObjects && listBindingMode === 'collection' ? (
                  <p className="text-[0.65rem] text-gray-500">Switch to “Display a specific item” to expose each object field.</p>
                ) : (
                  <p className="text-[0.65rem] text-gray-500">
                    {listBindingMode === 'collection'
                      ? 'The field will render the serialized list value.'
                      : 'Bind to an index to show a single list item or one of its nested properties.'}
                  </p>
                )}
              </div>
            ) : null}
            {shouldShowPropertySelector ? (
              <div className="space-y-2 rounded-lg border border-gray-200/80 bg-gray-50/60 p-3">
                <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">Select object property</p>
                {propertySource ? (
                  propertyLevels.length ? (
                    propertyLevels.map((level) => (
                      <select
                        key={`property-level-${level.depth}`}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-bw-amber focus:outline-none"
                        value={level.selected ?? ''}
                        aria-label={level.depth === 0 ? 'Select object property' : `Select nested property level ${level.depth + 1}`}
                        onChange={(event) => handlePropertyPathSelect(level.depth, event.target.value)}
                      >
                        <option value="">{level.depth === 0 ? 'Choose a property' : 'Choose nested property'}</option>
                        {level.options.map((option) => (
                          <option key={`${level.depth}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">Object sample has no properties to bind.</p>
                  )
                ) : (
                  <p className="text-xs text-gray-500">
                    {isListOfObjects
                      ? 'Provide a sample JSON for a single list item to expose its fields.'
                      : 'Provide a sample JSON for this object input to expose its fields.'}
                  </p>
                )}
                {displayPropertyPath.length ? (
                  <p className="text-[0.65rem] text-gray-500">
                    Binding path: <code className="font-mono text-xs">{displayPropertyPath.join('.')}</code>
                  </p>
                ) : (
                  <p className="text-[0.65rem] text-gray-500">Select a property to finish binding this field.</p>
                )}
              </div>
            ) : null}
            <div className="space-y-1 rounded-xl border border-dashed border-gray-200/80 p-3">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">Fallback value</p>
              {staticControl}
            </div>
          </>
        ) : (
          staticControl
        )}
        {helperText ? <p className="text-xs text-gray-500">{helperText}</p> : null}
      </div>
    </PropertyFilterGuard>
  );
};

type BaseFieldConfig = {
  fieldKey: string;
  bindingOptions: BindingOption[];
  helperText?: string;
  allowedDataTypes?: PageDynamicInputDataType[];
};

type TextFieldConfig = BaseFieldConfig & {
  label: string;
  placeholder?: string;
  inputType?: 'text' | 'number';
};

type TextareaFieldConfig = BaseFieldConfig & {
  label: string;
  placeholder?: string;
  rows?: number;
};

type SelectFieldConfig = BaseFieldConfig & {
  label: string;
  options: ReadonlyArray<{ label: string; value: string }>;
};

type BooleanFieldConfig = BaseFieldConfig & {
  label: string;
  trueLabel?: string;
  falseLabel?: string;
  defaultValue?: boolean;
};

const baseInputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed';

export const createDynamicTextField = ({
  fieldKey,
  bindingOptions,
  label,
  placeholder,
  inputType = 'text',
  helperText,
  allowedDataTypes
}: TextFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      placeholder={placeholder}
      helperText={helperText}
      allowedDataTypes={allowedDataTypes}
      renderStaticControl={({ inputId, value, onChange, readOnly }) => (
        <input
          id={inputId}
          type={inputType}
          className={baseInputClassName}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={readOnly}
        />
      )}
    />
  )
});

export const createDynamicTextareaField = ({
  fieldKey,
  bindingOptions,
  label,
  placeholder,
  rows = 3,
  helperText,
  allowedDataTypes
}: TextareaFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      placeholder={placeholder}
      helperText={helperText}
      allowedDataTypes={allowedDataTypes}
      renderStaticControl={({ inputId, value, onChange, readOnly }) => (
        <textarea
          id={inputId}
          className={baseInputClassName}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={readOnly}
          rows={rows}
          style={{ minHeight: rows * 24 }}
        />
      )}
    />
  )
});

export const createDynamicSelectField = ({
  fieldKey,
  bindingOptions,
  label,
  options,
  helperText,
  allowedDataTypes
}: SelectFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      helperText={helperText}
      allowedDataTypes={allowedDataTypes}
      renderStaticControl={({ inputId, value, onChange, readOnly, field }) => (
        <select
          id={inputId}
          className={baseInputClassName}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={readOnly}
        >
          {((field?.metadata?.[DYNAMIC_SELECT_OPTIONS_METADATA_KEY] as ReadonlyArray<{ label: string; value: string }>) ?? options).map(
            (option) => (
              <option key={option.value ?? option.label} value={option.value}>
                {option.label}
              </option>
            )
          )}
        </select>
      )}
    />
  )
});

export const DYNAMIC_SELECT_OPTIONS_METADATA_KEY = 'bwDynamicSelectOptions';

const TRUTHY_BOOLEAN_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSY_BOOLEAN_VALUES = new Set(['false', '0', 'no', 'off']);

const coerceBooleanOption = (value?: string, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (TRUTHY_BOOLEAN_VALUES.has(normalized)) {
    return true;
  }
  if (FALSY_BOOLEAN_VALUES.has(normalized)) {
    return false;
  }
  return fallback;
};

export const createDynamicBooleanField = ({
  fieldKey,
  bindingOptions,
  label,
  trueLabel = 'Enabled',
  falseLabel = 'Disabled',
  helperText,
  defaultValue = false,
  allowedDataTypes
}: BooleanFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      helperText={helperText}
      allowedDataTypes={allowedDataTypes}
      renderStaticControl={({ inputId, value, onChange, readOnly }) => {
        const effectiveValue = coerceBooleanOption(value, defaultValue) ? 'true' : 'false';
        return (
          <select
            id={inputId}
            className={baseInputClassName}
            value={effectiveValue}
            onChange={(event) => onChange(event.target.value)}
            disabled={readOnly}
          >
            <option value="true">{trueLabel}</option>
            <option value="false">{falseLabel}</option>
          </select>
        );
      }}
    />
  )
});


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
import type { ScalarValue } from '@buildweaver/libs';

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

type PropertyLevel = {
  depth: number;
  options: string[];
  selected?: string;
};

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
  helperText
}: DynamicFieldControlProps) => {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const fallbackInputId = `${resolvedId}-fallback`;
  const bindingSelectId = `${resolvedId}-binding`;
  const dynamicChoices = useMemo(() => getBindableOptions(bindingOptions), [bindingOptions]);
  const optionMap = useMemo(() => new Map(bindingOptions.map((option) => [option.value, option])), [bindingOptions]);
  const isDynamic = isDynamicBindingValue(value);
  const dynamicState = isDynamic ? (value as DynamicBindingState) : undefined;
  const staticValue = getStaticFallbackValue(value);
  const currentBindingId = dynamicState?.bindingId ?? '';
  const selectedOption = optionMap.get(currentBindingId);
  const propertySource = useMemo(() => getObjectSource(selectedOption), [selectedOption]);
  const propertyPathSignature = dynamicState ? JSON.stringify(dynamicState.propertyPath ?? []) : '';
  const normalizedPropertyPath = useMemo(
    () => (dynamicState ? sanitizePropertyPath(dynamicState.propertyPath) ?? [] : []),
    [dynamicState, propertyPathSignature]
  );
  const propertyLevels = useMemo(
    () => buildPropertyLevels(propertySource, normalizedPropertyPath),
    [propertySource, normalizedPropertyPath]
  );
  const shouldShowPropertySelector = Boolean(isDynamic && selectedOption?.dataType === 'object');
  const hasDynamicChoices = dynamicChoices.length > 0;
  const dynamicButtonDisabled = readOnly || !hasDynamicChoices;

  useEffect(() => {
    if (!isDynamic || !hasDynamicChoices || readOnly) {
      return;
    }
    if (currentBindingId && dynamicChoices.some((option) => option.value === currentBindingId)) {
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
    const normalized = normalizePropertyPathForSource(propertySource, dynamicState?.propertyPath);
    let nextPath = normalized;
    if ((!nextPath || !nextPath.length) && propertySource) {
      nextPath = deriveDefaultPropertyPath(propertySource);
    }
    if (!propertyPathsEqual(nextPath, dynamicState?.propertyPath)) {
      logDynamicFieldEvent('Object binding path synchronized', {
        fieldKey,
        bindingId: currentBindingId,
        nextPath
      });
      onChange(createDynamicBindingState(currentBindingId, staticValue, nextPath));
    }
  }, [
    currentBindingId,
    dynamicState?.propertyPath,
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
    logDynamicFieldEvent('Dynamic source updated', { fieldKey, bindingId: nextId });
    onChange(createDynamicBindingState(nextId, staticValue));
  };

  const handlePropertyPathSelect = useCallback(
    (depth: number, segment: string) => {
      if (!isDynamic || !currentBindingId) {
        return;
      }
      const trimmedPath = normalizedPropertyPath.slice(0, depth);
      const nextPath = segment ? [...trimmedPath, segment] : trimmedPath;
      logDynamicFieldEvent('Object property segment selected', {
        fieldKey,
        bindingId: currentBindingId,
        depth,
        nextPath
      });
      onChange(createDynamicBindingState(currentBindingId, staticValue, nextPath));
    },
    [currentBindingId, fieldKey, isDynamic, normalizedPropertyPath, onChange, staticValue]
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
            </div>
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
                  <p className="text-xs text-gray-500">Provide a sample JSON for this object input to expose its fields.</p>
                )}
                {normalizedPropertyPath.length ? (
                  <p className="text-[0.65rem] text-gray-500">
                    Binding path: <code className="font-mono text-xs">{normalizedPropertyPath.join('.')}</code>
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
  helperText?: string;
};

type BooleanFieldConfig = BaseFieldConfig & {
  label: string;
  trueLabel?: string;
  falseLabel?: string;
  helperText?: string;
  defaultValue?: boolean;
};

const baseInputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-bw-amber focus:outline-none disabled:cursor-not-allowed';

export const createDynamicTextField = ({ fieldKey, bindingOptions, label, placeholder, inputType = 'text' }: TextFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      placeholder={placeholder}
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
  rows = 3
}: TextareaFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      placeholder={placeholder}
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

export const createDynamicSelectField = ({ fieldKey, bindingOptions, label, options, helperText }: SelectFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      helperText={helperText}
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
  defaultValue = false
}: BooleanFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      helperText={helperText}
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


import type { CustomField, Field, FieldProps } from '@measured/puck';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo } from 'react';
import {
  BindingOption,
  DynamicBindingValue,
  createDynamicBindingState,
  getBindableOptions,
  getStaticFallbackValue,
  isDynamicBindingValue,
  logDynamicFieldEvent
} from './dynamic-binding';
import { PropertyFilterGuard } from './property-search';

const VARIABLE_ICON = '{ }';

export type StaticControlRendererProps = {
  inputId: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (next: string) => void;
  isFallback: boolean;
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
  labelActions
}: DynamicFieldControlProps) => {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const fallbackInputId = `${resolvedId}-fallback`;
  const bindingSelectId = `${resolvedId}-binding`;
  const dynamicChoices = useMemo(() => getBindableOptions(bindingOptions), [bindingOptions]);
  const isDynamic = isDynamicBindingValue(value);
  const staticValue = getStaticFallbackValue(value);
  const currentBindingId = isDynamic ? value.bindingId : '';
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
    isFallback: isDynamic
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
            <div className="space-y-1 rounded-xl border border-dashed border-gray-200/80 p-3">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gray-400">Fallback value</p>
              {staticControl}
            </div>
          </>
        ) : (
          staticControl
        )}
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

export const createDynamicSelectField = ({ fieldKey, bindingOptions, label, options }: SelectFieldConfig): Field => ({
  type: 'custom',
  label,
  render: (props) => (
    <DynamicFieldControl
      {...props}
      fieldKey={fieldKey}
      bindingOptions={bindingOptions}
      renderStaticControl={({ inputId, value, onChange, readOnly }) => (
        <select
          id={inputId}
          className={baseInputClassName}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={readOnly}
        >
          {options.map((option) => (
            <option key={option.value ?? option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    />
  )
});

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
      renderStaticControl={({ inputId, value, onChange, readOnly }) => {
        const effectiveValue = coerceBooleanOption(value, defaultValue) ? 'true' : 'false';
        return (
          <div className="space-y-1">
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
            {helperText ? <p className="text-xs text-gray-500">{helperText}</p> : null}
          </div>
        );
      }}
    />
  )
});


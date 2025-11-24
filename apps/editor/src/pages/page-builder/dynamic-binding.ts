export type BindingOption = {
	label: string;
	value: string;
};

export type BindingResolver = (text?: string, bindingId?: string) => string;

export type DynamicBindingState = {
	__bwDynamicBinding: true;
	bindingId: string;
	fallback?: string;
};

export type DynamicBindingValue = string | DynamicBindingState | null | undefined;

const DYNAMIC_FIELD_LOG_PREFIX = '[PageBuilder:DynamicField]';

export const logDynamicFieldEvent = (message: string, details?: Record<string, unknown>) => {
	if (typeof console === 'undefined' || typeof console.info !== 'function') {
		return;
	}
	console.info(`${DYNAMIC_FIELD_LOG_PREFIX} ${message}`, details ?? '');
};

export const isDynamicBindingValue = (value?: unknown): value is DynamicBindingState => {
	if (!value || typeof value !== 'object') {
		return false;
	}
	return (value as DynamicBindingState).__bwDynamicBinding === true;
};

export const createDynamicBindingState = (bindingId: string, fallback: string): DynamicBindingState => ({
	__bwDynamicBinding: true,
	bindingId,
	fallback
});

export const getStaticFallbackValue = (value: DynamicBindingValue): string => {
	if (isDynamicBindingValue(value)) {
		return value.fallback ?? '';
	}
	if (typeof value === 'string') {
		return value;
	}
	return '';
};

export const resolveDynamicBindingValue = (
	value: DynamicBindingValue,
	resolver: BindingResolver,
	legacyBindingId?: string
): string => {
	if (isDynamicBindingValue(value)) {
		return resolver(value.fallback, value.bindingId);
	}
	if (legacyBindingId) {
		return resolver(typeof value === 'string' ? value : undefined, legacyBindingId);
	}
	if (typeof value === 'string') {
		return value;
	}
	return '';
};

export const getBindableOptions = (options: BindingOption[]): BindingOption[] => options.filter((option) => Boolean(option.value));

export const hasBindableOptions = (options: BindingOption[]): boolean => getBindableOptions(options).length > 0;


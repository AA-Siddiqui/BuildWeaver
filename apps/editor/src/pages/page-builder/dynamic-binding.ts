import type { PageDynamicInputDataType, PageDynamicListItemType, ScalarValue } from '@buildweaver/libs';

export type BindingOption = {
	label: string;
	value: string;
	dataType?: PageDynamicInputDataType;
	objectSample?: Record<string, ScalarValue>;
	listItemType?: PageDynamicListItemType;
	listObjectSample?: Record<string, ScalarValue>;
	previewValue?: ScalarValue;
};

export type BindingResolver = (text?: string, bindingId?: string, propertyPath?: string[]) => string;

export type DynamicBindingState = {
	__bwDynamicBinding: true;
	bindingId: string;
	fallback?: string;
  propertyPath?: string[];
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

export const createDynamicBindingState = (bindingId: string, fallback: string, propertyPath?: string[]): DynamicBindingState => ({
	__bwDynamicBinding: true,
	bindingId,
	fallback,
	propertyPath: sanitizePropertyPath(propertyPath)
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
		return resolver(value.fallback, value.bindingId, value.propertyPath);
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

export const sanitizePropertyPath = (path?: string[]): string[] | undefined => {
	if (!path || !Array.isArray(path)) {
		return undefined;
	}
	const sanitized = path.map((segment) => String(segment ?? '').trim()).filter((segment) => segment.length > 0);
	return sanitized.length ? sanitized : undefined;
};

export const resolvePropertyPathValue = (value: ScalarValue | undefined, propertyPath?: string[]): ScalarValue | undefined => {
	if (!propertyPath || !propertyPath.length) {
		return value;
	}
	let current: ScalarValue | undefined = value;
	for (const segment of propertyPath) {
		if (typeof segment === 'undefined' || segment === null || segment === '') {
			return undefined;
		}
		if (Array.isArray(current)) {
			const index = Number(segment);
			if (!Number.isInteger(index) || index < 0 || index >= current.length) {
				return undefined;
			}
			current = current[index] as ScalarValue;
			continue;
		}
		if (!current || typeof current !== 'object') {
			return undefined;
		}
		if (!Object.prototype.hasOwnProperty.call(current, segment)) {
			return undefined;
		}
		current = (current as Record<string, ScalarValue>)[segment];
	}
	return current;
};

export const formatBindingPlaceholder = (label: string, propertyPath?: string[]): string => {
	if (!propertyPath || !propertyPath.length) {
		return label;
	}
	return `${label}.${propertyPath.join('.')}`;
};


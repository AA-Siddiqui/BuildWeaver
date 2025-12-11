import * as React from 'react';
import { createContext, createElement, useContext, type PropsWithChildren } from 'react';
import type { ScalarValue } from '@buildweaver/libs';
import { resolvePropertyPathValue } from './dynamic-binding';

export const LIST_SCOPE_BINDING_PREFIX = '__bwListItem:' as const;

const LIST_SCOPE_LOG_PREFIX = '[PageBuilder:ListScope]';

const logListScopeEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }
  console.info(`${LIST_SCOPE_LOG_PREFIX} ${message}`, details ?? '');
};

export type ListSlotContextValue = {
  listComponentId?: string;
  sourceBindingId?: string;
  currentIndex: number;
  itemValue?: ScalarValue;
  resolvedEntry?: {
    text?: string | null;
    description?: string | null;
    icon?: string | null;
  };
};

const runtimeStack: ListSlotContextValue[] = [];

export const pushListSlotRuntimeContext = (value: ListSlotContextValue) => {
  runtimeStack.push(value);
};

export const popListSlotRuntimeContext = () => {
  runtimeStack.pop();
};

type ReactDispatcher = {
  readContext?: <T>(context: React.Context<T>) => T;
};

type ReactInternals = {
  ReactCurrentDispatcher?: {
    current?: ReactDispatcher;
  };
};

const getDispatcher = (): ReactDispatcher | undefined => {
  const internals = (React as typeof React & {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: ReactInternals;
  }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  return internals?.ReactCurrentDispatcher?.current;
};

const readContextFromDispatcher = (): ListSlotContextValue | undefined => {
  const dispatcher = getDispatcher();
  if (!dispatcher?.readContext) {
    return undefined;
  }
  try {
    return dispatcher.readContext(InternalListSlotContext);
  } catch (error) {
    logListScopeEvent('Failed to read React context for list scope', {
      error: error instanceof Error ? error.message : 'unknown'
    });
    return undefined;
  }
};

export const getActiveListSlotRuntimeContext = () => runtimeStack[runtimeStack.length - 1] ?? readContextFromDispatcher();

const isTemplateListIndexSegment = (segment?: string) => segment === '0';

export const projectListSlotPropertyPath = (
  bindingId?: string,
  propertyPath?: string[]
): string[] | undefined => {
  const context = getActiveListSlotRuntimeContext();
  if (!context || !context.sourceBindingId || bindingId !== context.sourceBindingId) {
    return propertyPath;
  }
  if (!propertyPath?.length) {
    return propertyPath;
  }
  const [head, ...tail] = propertyPath;
  if (!isTemplateListIndexSegment(head)) {
    return propertyPath;
  }
  return [String(context.currentIndex), ...tail];
};

const InternalListSlotContext = createContext<ListSlotContextValue | undefined>(undefined);

export const ListSlotContextProvider = ({ value, children }: PropsWithChildren<{ value: ListSlotContextValue }>) =>
  createElement(InternalListSlotContext.Provider, { value }, children);

export const useListSlotContext = () => {
  const context = useContext(InternalListSlotContext);
  if (!context) {
    throw new Error('useListSlotContext must be used within a ListSlotContextProvider');
  }
  return context;
};

export const resolveListSlotScopedValue = (
  bindingId?: string,
  propertyPath?: string[]
): ScalarValue | undefined => {
  if (!bindingId?.startsWith(LIST_SCOPE_BINDING_PREFIX)) {
    return undefined;
  }
  const targetListId = bindingId.slice(LIST_SCOPE_BINDING_PREFIX.length);
  const context = getActiveListSlotRuntimeContext();
  if (!context) {
    logListScopeEvent('Missing runtime context for scoped binding', { bindingId, propertyPath });
    return undefined;
  }
  if (context.listComponentId !== targetListId) {
    logListScopeEvent('Scoped binding resolved outside its list component', {
      bindingId,
      propertyPath,
      activeComponentId: context.listComponentId
    });
    return undefined;
  }
  if (!propertyPath?.length) {
    return context.itemValue;
  }
  return resolvePropertyPathValue(context.itemValue, propertyPath);
};

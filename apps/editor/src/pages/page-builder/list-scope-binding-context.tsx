import { createContext, useContext, type ReactNode } from 'react';
import type { BindingOption } from './dynamic-binding';

export type ListScopeBindingLookup = Map<string, BindingOption[]>;

const ListScopeBindingContext = createContext<ListScopeBindingLookup | null>(null);

export const ListScopeBindingProvider = ({
  lookup,
  children
}: {
  lookup: ListScopeBindingLookup;
  children: ReactNode;
}) => <ListScopeBindingContext.Provider value={lookup}>{children}</ListScopeBindingContext.Provider>;

export const useListScopeBindingOptions = (componentId?: string): BindingOption[] => {
  const lookup = useContext(ListScopeBindingContext);
  if (!lookup || !componentId) {
    return [];
  }
  return lookup.get(componentId) ?? [];
};

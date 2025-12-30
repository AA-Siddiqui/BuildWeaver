import { createContext, useContext, type ReactNode } from 'react';
import type { ComponentData, Data } from '@measured/puck';
import type { ComponentBindingReference, ProjectComponentDocument } from '@buildweaver/libs';
import type { BindingOption } from './dynamic-binding';

export type SaveComponentRequest = {
  name: string;
  targetId: string;
  definition: ComponentData;
  bindingReferences: ComponentBindingReference[];
};

export type ComponentLibraryContextValue = {
  builderState: Data;
  bindingOptions: BindingOption[];
  componentLibrary: ProjectComponentDocument[];
  isSavingComponent: boolean;
  saveComponent: (request: SaveComponentRequest) => Promise<void>;
  log?: (message: string, details?: Record<string, unknown>) => void;
};

const defaultContext: ComponentLibraryContextValue = {
  builderState: { root: { props: {} }, content: [] },
  bindingOptions: [],
  componentLibrary: [],
  isSavingComponent: false,
  saveComponent: async () => undefined
};

const ComponentLibraryContext = createContext<ComponentLibraryContextValue>(defaultContext);

export const ComponentLibraryProvider = ({
  value,
  children
}: {
  value: ComponentLibraryContextValue;
  children: ReactNode;
}) => <ComponentLibraryContext.Provider value={value}>{children}</ComponentLibraryContext.Provider>;

export const useComponentLibrary = () => useContext(ComponentLibraryContext);

import { createContext, ReactNode, useContext } from 'react';

export interface PageRouteRegistryValue {
  routes: string[];
  isRouteAvailable: (route: string, currentPageId?: string) => boolean;
}

const PageRouteRegistryContext = createContext<PageRouteRegistryValue | null>(null);

interface ProviderProps {
  value: PageRouteRegistryValue;
  children: ReactNode;
}

export const PageRouteRegistryProvider = ({ value, children }: ProviderProps) => (
  <PageRouteRegistryContext.Provider value={value}>{children}</PageRouteRegistryContext.Provider>
);

export const usePageRouteRegistry = () => useContext(PageRouteRegistryContext);

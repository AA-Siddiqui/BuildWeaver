import { createContext, ReactNode, useContext } from 'react';

export interface LogicNavigationContextValue {
  openPageBuilder: (pageId: string) => void;
}

const LogicNavigationContext = createContext<LogicNavigationContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  value: LogicNavigationContextValue;
}

export const LogicNavigationProvider = ({ children, value }: ProviderProps) => (
  <LogicNavigationContext.Provider value={value}>{children}</LogicNavigationContext.Provider>
);

export const useLogicNavigation = () => useContext(LogicNavigationContext);

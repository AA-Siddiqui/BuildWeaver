import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { UserDefinedFunction } from '@buildweaver/libs';

interface FunctionRegistryValue {
  functions: UserDefinedFunction[];
  getFunctionById: (functionId: string) => UserDefinedFunction | undefined;
}

const defaultValue: FunctionRegistryValue = {
  functions: [],
  getFunctionById: () => undefined
};

const FunctionRegistryContext = createContext<FunctionRegistryValue>(defaultValue);

interface FunctionRegistryProviderProps {
  functions: UserDefinedFunction[];
  children: ReactNode;
}

export const FunctionRegistryProvider = ({ functions, children }: FunctionRegistryProviderProps) => {
  const value = useMemo<FunctionRegistryValue>(
    () => ({
      functions,
      getFunctionById: (functionId: string) => functions.find((fn) => fn.id === functionId)
    }),
    [functions]
  );

  return <FunctionRegistryContext.Provider value={value}>{children}</FunctionRegistryContext.Provider>;
};

export const useFunctionRegistry = () => useContext(FunctionRegistryContext);

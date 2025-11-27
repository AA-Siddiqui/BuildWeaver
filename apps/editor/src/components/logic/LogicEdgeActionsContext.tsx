import { createContext, ReactNode, useContext } from 'react';

export type SeverEdgeReason = 'hover-button' | 'cut-gesture';

export interface LogicEdgeActionsContextValue {
  severEdge: (edgeId: string, options: { reason: SeverEdgeReason }) => void;
}

const LogicEdgeActionsContext = createContext<LogicEdgeActionsContextValue | undefined>(undefined);

export const LogicEdgeActionsProvider = ({
  children,
  value
}: {
  children: ReactNode;
  value: LogicEdgeActionsContextValue;
}): JSX.Element => (
  <LogicEdgeActionsContext.Provider value={value}>{children}</LogicEdgeActionsContext.Provider>
);

export const useLogicEdgeActions = (): LogicEdgeActionsContextValue => {
  const context = useContext(LogicEdgeActionsContext);
  if (!context) {
    throw new Error('useLogicEdgeActions must be used within LogicEdgeActionsProvider');
  }
  return context;
};

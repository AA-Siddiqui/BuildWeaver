import { createContext, useContext, ReactNode } from 'react';
import type { DatabaseSchema, DatabaseTable, DatabaseField, QueryMode } from '@buildweaver/libs';

interface QuerySchemaContextValue {
  schema: DatabaseSchema | null;
  tables: DatabaseTable[];
  mode: QueryMode;
  getTableFields: (tableName: string) => DatabaseField[];
}

const QuerySchemaContext = createContext<QuerySchemaContextValue>({
  schema: null,
  tables: [],
  mode: 'read',
  getTableFields: () => []
});

export const useQuerySchema = () => useContext(QuerySchemaContext);

interface QuerySchemaProviderProps {
  schema: DatabaseSchema | null;
  mode: QueryMode;
  children: ReactNode;
}

export const QuerySchemaProvider = ({ schema, mode, children }: QuerySchemaProviderProps) => {
  const tables = schema?.tables ?? [];
  const getTableFields = (tableName: string): DatabaseField[] => {
    const table = tables.find(t => t.name === tableName);
    return table?.fields ?? [];
  };
  return (
    <QuerySchemaContext.Provider value={{ schema, tables, mode, getTableFields }}>
      {children}
    </QuerySchemaContext.Provider>
  );
};

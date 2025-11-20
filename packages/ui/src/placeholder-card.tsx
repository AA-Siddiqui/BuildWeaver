import type { FC, ReactNode } from 'react';

export const PlaceholderCard: FC<{ title: string; children?: ReactNode }> = ({ title, children }) => (
  <div style={{ padding: '1rem', borderRadius: '0.5rem', border: '1px solid #475569' }}>
    <strong>{title}</strong>
    <div>{children}</div>
  </div>
);

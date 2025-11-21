import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './index.css';

const root = document.getElementById('root') as HTMLElement;
const queryClient = new QueryClient();

const bootstrapEnv = () => {
  if (typeof window !== 'undefined') {
    window.__APP_API_BASE_URL__ = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  }
};

bootstrapEnv();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

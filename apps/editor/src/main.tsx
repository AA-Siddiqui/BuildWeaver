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
    const apiUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
    window.__APP_API_BASE_URL__ = apiUrl;
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

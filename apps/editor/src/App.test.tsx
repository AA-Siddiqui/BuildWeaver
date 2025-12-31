import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

jest.mock('@measured/puck', () => ({
  Puck: () => null
}));

describe('App', () => {
  it('renders hero headline and CTA', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Build Apps/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start Building Free/i })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders hero headline and CTA', () => {
    render(<App />);
    expect(screen.getByText(/Build production-grade apps/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Editor/i })).toBeInTheDocument();
  });
});

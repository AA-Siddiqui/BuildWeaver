import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const token = useAuthStore((state) => state.token);
  const redirectTo = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ?? '/workspace';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: typeof form) => authApi.login(payload),
    onSuccess: (data) => {
      setAuth(data);
      navigate(redirectTo, { replace: true });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Unable to login right now');
    }
  });

  useEffect(() => {
    if (token) {
      navigate(redirectTo, { replace: true });
    }
  }, [token, redirectTo, navigate]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    mutation.mutate(form);
  };

  return (
    <section className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-10 shadow-lg">
      <h1 className="mb-2 text-2xl font-semibold text-white">Welcome back</h1>
      <p className="mb-6 text-sm text-bw-platinum/80">Enter your credentials to access your workspace.</p>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-bw-platinum/80">
          Email
          <input
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-bw-ink px-3 py-2 text-white focus:border-bw-sand focus:outline-none"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </label>
        <label className="text-sm font-medium text-bw-platinum/80">
          Password
          <input
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-xl border border-white/10 bg-bw-ink px-3 py-2 text-white focus:border-bw-sand focus:outline-none"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl bg-bw-sand px-4 py-2 font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {mutation.isPending ? 'Signing in…' : 'Login'}
        </button>
      </form>
      <p className="mt-4 text-sm text-bw-platinum/70">
        Need an account?{' '}
        <Link to="/signup" className="text-bw-sand underline">
          Create one
        </Link>
        .
      </p>
    </section>
  );
};

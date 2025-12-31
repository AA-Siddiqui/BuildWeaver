import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';

const GlowOrb = ({ className }: { className?: string }) => (
  <div
    className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
    aria-hidden
  />
);

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
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <GlowOrb className="-left-20 top-1/4 h-72 w-72 bg-bw-crimson/20" />
      <GlowOrb className="-right-20 bottom-1/4 h-64 w-64 bg-bw-clay/15" />
      <GlowOrb className="left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 bg-bw-sand/5" />

      <section className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-10 shadow-2xl backdrop-blur-sm">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-bw-crimson to-bw-clay text-xl font-black text-white shadow-lg shadow-bw-crimson/20">
              BW
            </div>
          </div>

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-sm text-bw-platinum/60">Sign in to continue to your workspace</p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-bw-platinum/80">
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-bw-platinum/30 transition-all focus:border-bw-sand/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-bw-sand/20"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-bw-platinum/80">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-bw-platinum/30 transition-all focus:border-bw-sand/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-bw-sand/20"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="group relative mt-2 overflow-hidden rounded-xl bg-gradient-to-r from-bw-crimson to-bw-clay px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-bw-crimson/20 disabled:opacity-60 disabled:hover:scale-100"
            >
              <span className="relative z-10">
                {mutation.isPending ? 'Signing in...' : 'Sign In'}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-bw-clay to-bw-crimson opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-bw-platinum/40">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-bw-platinum/60">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-semibold text-bw-sand transition hover:text-bw-amber"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Back to home */}
        <p className="mt-6 text-center text-sm text-bw-platinum/40">
          <Link to="/" className="transition hover:text-bw-sand">
            ← Back to home
          </Link>
        </p>
      </section>
    </div>
  );
};

import { useEffect } from 'react';
import { authApi } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';

export const useInitializeAuth = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!hasHydrated || !token || user) {
      return;
    }

    let cancelled = false;
    authApi
      .me()
      .then(({ user: profile }) => {
        if (!cancelled) {
          setAuth({ token, user: profile });
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, token, user, setAuth, logout]);
};

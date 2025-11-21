import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { AuthUser } from '../types/api';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setAuth: (payload: { token: string; user: AuthUser }) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

const storageFactory = () => (typeof window === 'undefined' ? noopStorage : window.localStorage);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setAuth: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (value: boolean) => set({ hasHydrated: value })
    }),
    {
      name: 'bw-auth',
      storage: createJSONStorage(storageFactory),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true)
    }
  )
);

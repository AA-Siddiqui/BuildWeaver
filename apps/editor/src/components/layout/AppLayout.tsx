import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const hideHeader = location.pathname.startsWith('/app/');

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bw-ink text-bw-platinum">
      {!hideHeader && (
        <header className="sticky top-0 z-10 border-b border-white/10 bg-bw-ink/90 backdrop-blur">
          <div className="bw-container flex items-center justify-between py-4">
            <Link to="/" className="text-lg font-semibold tracking-tight text-bw-sand">
              BuildWeaver
            </Link>
            <nav className="flex items-center gap-3 text-sm font-medium">
              <Link className="rounded-full px-3 py-1 text-bw-platinum/80 transition hover:text-white" to="/">
                Home
              </Link>
              {user ? (
                <>
                  <Link className="rounded-full px-3 py-1 text-bw-platinum/80 transition hover:text-white" to="/workspace">
                    Workspace
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:bg-white/10"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link className="rounded-full px-3 py-1 text-bw-platinum/80 transition hover:text-white" to="/login">
                    Login
                  </Link>
                  <Link className="rounded-full bg-bw-sand px-4 py-1 text-bw-ink transition hover:-translate-y-0.5" to="/signup">
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
};

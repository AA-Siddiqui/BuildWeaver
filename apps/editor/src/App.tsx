import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { ProjectLogicPage } from './pages/ProjectLogicPage';
import { PageBuilderPage } from './pages/PageBuilderPage';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { useInitializeAuth } from './hooks/useInitializeAuth';

export const App = () => {
  useInitializeAuth();

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <WorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/:projectId"
          element={
            <ProtectedRoute>
              <ProjectLogicPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/:projectId/page/:pageId"
          element={
            <ProtectedRoute>
              <PageBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
};

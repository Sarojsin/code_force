import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from 'src/components/layout/AppShell';
import { RouteGuard } from 'src/components/layout/RouteGuard';
import { LoadingScreen } from 'src/components/ui/Spinner';
import { Broadcast } from 'src/pages/Broadcast';
import { ContentLibrary } from 'src/pages/ContentLibrary';
import { Login } from 'src/pages/Login';
import { Overview } from 'src/pages/Overview';
import { AuditLogs, Evaluation, ModelRegistry, TrainingRuns } from 'src/pages/StubPages';
import { Users } from 'src/pages/Users';
import { useAuthStore } from 'src/stores/authStore';

function RequireAuth() {
  const status = useAuthStore(state => state.status);
  const location = useLocation();

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (status === 'idle' || status === 'loading') {
    return <LoadingScreen label="Signing you in…" />;
  }
  return <RouteGuard children={<AppShell />} />;
}

export default function App() {
  useEffect(() => {
    void useAuthStore.getState().init();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Overview />} />
        <Route path="/users" element={<Users />} />
        <Route path="/content" element={<ContentLibrary />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/training" element={<TrainingRuns />} />
        <Route path="/models" element={<ModelRegistry />} />
        <Route path="/evaluation" element={<Evaluation />} />
        <Route path="/audit" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

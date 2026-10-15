import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.tsx';
import { Layout } from './components/Layout.tsx';
import { Login } from './pages/Login.tsx';
import { Register } from './pages/Register.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Accounts } from './pages/Accounts.tsx';
import { Scans } from './pages/Scans.tsx';
import { ScanDetail } from './pages/ScanDetail.tsx';
import { Settings } from './pages/Settings.tsx';
import { Manual } from './pages/Manual.tsx';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="scans" element={<Scans />} />
          <Route path="scans/:id" element={<ScanDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="manual" element={<Manual />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

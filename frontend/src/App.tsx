import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { auth } from './services/api';
import { useAppStore } from './hooks/useStore';
import PinLogin       from './components/pos/PinLogin';
import POSDashboard   from './components/pos/POSDashboard';
import KDSDashboard   from './components/kds/KDSDashboard';
import StaffPortal    from './components/staff/StaffPortal';
import SuperAdminDashboard from './components/dashboard/SuperAdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false } },
});

// ── POS App (login + dashboard) ───────────────────────────────────────────
function POSApp() {
  const { isLoggedIn, setStaff } = useAppStore();
  function handleLogout() { auth.clearAll(); setStaff(null); }
  if (!isLoggedIn) return <PinLogin onSuccess={() => {}} />;
  return <POSDashboard onLogout={handleLogout} />;
}

// ── Staff app (requires auth via PIN) ─────────────────────────────────────
function StaffApp() {
  const { isLoggedIn, setStaff } = useAppStore();
  if (!isLoggedIn) return <PinLogin onSuccess={() => {}} />;
  return <StaffPortal />;
}

// ── KDS (kitchen display — requires auth, landscape optimised) ────────────
function KDSApp() {
  const { isLoggedIn } = useAppStore();
  if (!isLoggedIn) return <PinLogin onSuccess={() => {}} />;
  return <KDSDashboard />;
}

export default function App() {
  // Register PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* POS tablet */}
          <Route path="/"      element={<POSApp />} />
          <Route path="/pos"   element={<POSApp />} />
          {/* Kitchen Display */}
          <Route path="/kds"   element={<KDSApp />} />
          {/* Staff Portal */}
          <Route path="/staff" element={<StaffApp />} />
          {/* Super Admin */}
          <Route path="/admin" element={<SuperAdminDashboard />} />
          {/* Fallback */}
          <Route path="*"      element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

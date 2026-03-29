import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider }  from './lib/store';
import { SyncBar }      from './components/ui/SyncBar';
import { ToastStack }   from './components/ui/ToastStack';
import { PageLoader }   from './components/ui/PageLoader';
import { PrivateRoute } from './components/auth/PrivateRoute';

const HomePage        = lazy(() => import('./pages/public/HomePage'));
const MenuPage        = lazy(() => import('./pages/public/MenuPage'));
const PublicOrderPage = lazy(() => import('./pages/public/PublicOrderPage'));
const CustomerAppPage = lazy(() => import('./pages/public/CustomerAppPage'));
const ReservePage     = lazy(() => import('./pages/public/ReservePage'));
const TrackingPage    = lazy(() => import('./pages/public/TrackingPage'));
const GiftCardPage    = lazy(() => import('./pages/public/GiftCardPage'));

const StaffPortalPage = lazy(() => import('./pages/staff/StaffPortal'));
const KDSPage         = lazy(() => import('./pages/staff/KDSPage'));
const POSPortalPage   = lazy(() => import('./pages/pos/POSPage'));
const AdminPortalPage = lazy(() => import('./pages/admin/AdminPage'));
const AnalyticsPage   = lazy(() => import('./pages/admin/AnalyticsPage'));

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <SyncBar />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"              element={<HomePage />} />
            <Route path="/menu"          element={<MenuPage />} />
            <Route path="/order"         element={<PublicOrderPage />} />
            <Route path="/app/customer"  element={<CustomerAppPage />} />
            <Route path="/reserve"       element={<ReservePage />} />
            <Route path="/track"         element={<TrackingPage />} />
            <Route path="/gift-cards"    element={<GiftCardPage />} />

            <Route path="/portal/staff" element={
              <PrivateRoute scope="staff"><StaffPortalPage /></PrivateRoute>
            }/>
            <Route path="/portal/kds" element={
              <PrivateRoute scope="staff"><KDSPage /></PrivateRoute>
            }/>
            <Route path="/portal/pos" element={
              <PrivateRoute scope="admin"><POSPortalPage /></PrivateRoute>
            }/>
            <Route path="/portal/admin/*" element={
              <PrivateRoute scope="admin"><AdminPortalPage /></PrivateRoute>
            }/>
            <Route path="/portal/analytics" element={
              <PrivateRoute scope="admin"><AnalyticsPage /></PrivateRoute>
            }/>

            <Route path="/cart"      element={<Navigate to="/order"        replace />}/>
            <Route path="/account"   element={<Navigate to="/app/customer" replace />}/>
            <Route path="/staff"     element={<Navigate to="/portal/staff" replace />}/>
            <Route path="/pos"       element={<Navigate to="/portal/pos"   replace />}/>
            <Route path="/admin"     element={<Navigate to="/portal/admin" replace />}/>
            <Route path="/admin/*"   element={<Navigate to="/portal/admin" replace />}/>
            <Route path="/kds"       element={<Navigate to="/portal/kds"   replace />}/>
            <Route path="/analytics" element={<Navigate to="/portal/analytics" replace />}/>
            <Route path="*" element={<Navigate to="/" replace />}/>
          </Routes>
        </Suspense>
        <ToastStack />
      </BrowserRouter>
    </AppProvider>
  );
}

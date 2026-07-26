import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from './store';
import { ToastProvider } from './components/ui/Toast';
import { PublicLayout } from './layouts/PublicLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import { MerchantLayout } from './layouts/MerchantLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Unauthorized } from './pages/Unauthorized';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { authSuccess, authFailure, setLoading } from './store/authSlice';
import api from './services/api';

// Route Redirector for root path '/'
const HomeRedirect = () => {
  const { user, isAuthenticated, loading } = useSelector((state) => state.auth);

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'ADMIN' || user?.role === 'AUDITOR') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user?.role === 'MERCHANT') {
    return <Navigate to="/merchant/dashboard" replace />;
  } else {
    return <Navigate to="/customer/dashboard" replace />;
  }
};

const AppRoutes = () => {
  const dispatch = useDispatch();

  // Handle auto-login persistence on startup/refresh
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await api.get('/auth/me');
        const { user, accessToken } = response.data.data;
        dispatch(authSuccess({ user, accessToken }));
      } catch (err) {
        dispatch(authFailure(null));
      } finally {
        dispatch(setLoading(false));
      }
    };
    initializeAuth();
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Customer Dashboard Routes */}
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['CUSTOMER']}>
              <CustomerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<PlaceholderPage title="Customer Dashboard Overview" />} />
          <Route path="wallet" element={<PlaceholderPage title="My Wallet & Sandbox Cards" />} />
          <Route path="send" element={<PlaceholderPage title="Send Money Transfer" />} />
          <Route path="transactions" element={<PlaceholderPage title="My Transaction History" />} />
          <Route path="profile" element={<PlaceholderPage title="My Personal Profile" />} />
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Merchant Dashboard Routes */}
        <Route
          path="/merchant"
          element={
            <ProtectedRoute allowedRoles={['MERCHANT']}>
              <MerchantLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<PlaceholderPage title="Merchant Dashboard Overview" />} />
          <Route path="payments" element={<PlaceholderPage title="Merchant Payment Orders" />} />
          <Route path="refunds" element={<PlaceholderPage title="Merchant Refunds History" />} />
          <Route path="api-keys" element={<PlaceholderPage title="Sandbox API Key Credentials" />} />
          <Route path="webhooks" element={<PlaceholderPage title="Webhook Endpoints & Logs" />} />
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Operations Admin Dashboard Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<PlaceholderPage title="System Operations Overview" />} />
          <Route path="customers" element={<PlaceholderPage title="Sandbox Customers Explorer" />} />
          <Route path="merchants" element={<PlaceholderPage title="Sandbox Merchants Explorer" />} />
          <Route path="wallets" element={<PlaceholderPage title="System Wallets Ledger" />} />
          <Route path="payments" element={<PlaceholderPage title="Payment Orders Explorer" />} />
          <Route path="transfers" element={<PlaceholderPage title="Transfer Entries Explorer" />} />
          <Route path="ledger" element={<PlaceholderPage title="Double-Entry Ledger Book" />} />
          <Route path="risk" element={<PlaceholderPage title="Risk Controls & Events" />} />
          <Route path="webhooks" element={<PlaceholderPage title="Webhook Deliveries Explorer" />} />
          <Route path="reconciliation" element={<PlaceholderPage title="Reconciliation Run Reports" />} />
          <Route path="audit" element={<PlaceholderPage title="Immutable Audit Trail Logs" />} />
          <Route path="health" element={<PlaceholderPage title="Databases & Services Health" />} />
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Fallbacks */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export function App() {
  return (
    <Provider store={store}>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </Provider>
  );
}

export default App;

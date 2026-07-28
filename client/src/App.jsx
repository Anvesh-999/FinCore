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
import { Wallet } from './pages/customer/Wallet';
import { Send } from './pages/customer/Send';
import { Transactions } from './pages/customer/Transactions';
import { WalletsExplorer } from './pages/admin/WalletsExplorer';
import { TransfersExplorer } from './pages/admin/TransfersExplorer';
import { LedgerBook } from './pages/admin/LedgerBook';
import { Overview as MerchantOverview } from './pages/merchant/Overview';
import { Payments as MerchantPayments } from './pages/merchant/Payments';
import { ApiKeys as MerchantApiKeys } from './pages/merchant/ApiKeys';
import { Refunds as MerchantRefunds } from './pages/merchant/Refunds';
import { Checkout } from './pages/customer/Checkout';
import { PaymentsExplorer } from './pages/admin/PaymentsExplorer';
import { RefundsExplorer } from './pages/admin/RefundsExplorer';
import { Webhooks as MerchantWebhooks } from './pages/merchant/Webhooks';
import { RiskExplorer } from './pages/admin/RiskExplorer';
import { Reconciliation } from './pages/admin/Reconciliation';
import { WebhooksExplorer } from './pages/admin/WebhooksExplorer';
import { useToast } from './components/ui/Toast';
import { connectSocket, disconnectSocket } from './services/socket';



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
  const { isAuthenticated, accessToken, user } = useSelector((state) => state.auth);
  const { showToast } = useToast();

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

  // Handle Socket.IO connection and real-time operations toasts
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      const socket = connectSocket(accessToken);
      
      // Admin real-time alerts
      if (user?.role === 'ADMIN' || user?.role === 'AUDITOR') {
        socket.on('risk.alert', (data) => {
          showToast('error', `[RISK ALERT] Transaction ${data.transaction_id} triggered rules: ${data.rules_triggered.join(', ')} (Score: ${data.risk_score})`);
        });

        socket.on('reconciliation.alert', (data) => {
          showToast('error', `[LEDGER AUDIT ALERT] Reconciliation run detected ${data.inconsistencies_found} discrepancies!`);
        });
      }
      
      // General payment updates
      socket.on('payment.updated', (data) => {
        showToast('info', `[PAYMENT UPDATE] Order ${data.id} is now ${data.status}`);
      });
      
      // General transfer updates
      socket.on('transfer.updated', (data) => {
        showToast('info', `[TRANSFER UPDATE] Transfer of $${(parseInt(data.amount) / 100).toFixed(2)} completed`);
      });

      return () => {
        socket.off('risk.alert');
        socket.off('reconciliation.alert');
        socket.off('payment.updated');
        socket.off('transfer.updated');
      };
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, accessToken, user, showToast]);

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
          <Route path="wallet" element={<Wallet />} />
          <Route path="send" element={<Send />} />
          <Route path="transactions" element={<Transactions />} />
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
          <Route path="dashboard" element={<MerchantOverview />} />
          <Route path="payments" element={<MerchantPayments />} />
          <Route path="refunds" element={<MerchantRefunds />} />
          <Route path="api-keys" element={<MerchantApiKeys />} />
          <Route path="webhooks" element={<MerchantWebhooks />} />
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Standalone Customer Checkout Route */}
        <Route
          path="/checkout/:paymentId"
          element={
            <ProtectedRoute allowedRoles={['CUSTOMER']}>
              <Checkout />
            </ProtectedRoute>
          }
        />

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
          <Route path="wallets" element={<WalletsExplorer />} />
          <Route path="payments" element={<PaymentsExplorer />} />
          <Route path="refunds" element={<RefundsExplorer />} />
          <Route path="transfers" element={<TransfersExplorer />} />
          <Route path="ledger" element={<LedgerBook />} />

          <Route path="risk" element={<RiskExplorer />} />
          <Route path="webhooks" element={<WebhooksExplorer />} />
          <Route path="reconciliation" element={<Reconciliation />} />
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

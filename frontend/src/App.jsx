import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe, logout } from './api';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Balance from './pages/Balance';
import Transfer from './pages/Transfer';
import TransactionHistory from './pages/TransactionHistory';
import Account from './pages/Account';
import ChatAI from './pages/ChatAI';

function PrivateRoute({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getMe()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  async function handleLogout() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  }
  if (loading) return <div className="app-loading"><div className="loading-state"><span className="loading-dot" aria-hidden="true" />Loading…</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout user={user} onLogout={handleLogout}>
      {children}
    </AppLayout>
  );
}

function PublicOnly({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getMe()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="app-loading"><div className="loading-state"><span className="loading-dot" aria-hidden="true" />Loading…</div></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Always show the actual login form first for security: no "already signed in" shortcut. */
function LoginGate() {
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginGate />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/balance" element={<PrivateRoute><Balance /></PrivateRoute>} />
      <Route path="/transfer" element={<PrivateRoute><Transfer /></PrivateRoute>} />
      <Route path="/transactions" element={<PrivateRoute><TransactionHistory /></PrivateRoute>} />
      <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><ChatAI /></PrivateRoute>} />
      <Route path="/" element={<LoginGate />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

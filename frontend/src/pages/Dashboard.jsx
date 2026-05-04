import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMe } from '../api';
import ChatFullscreen from '../components/ChatFullscreen';

const IconBalance = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M16 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
  </svg>
);
const IconTransfer = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 17 5-5-5-5" />
    <path d="m17 7-5 5 5 5" />
  </svg>
);
const IconHistory = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconAccount = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);
const IconChat = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IconClose = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    getMe()
      .then((r) => setUser(r.user))
      .catch(() => navigate('/login'));
  }, [navigate]);

  if (!user) return <div className="app-content"><div className="loading-state"><span className="loading-dot" aria-hidden="true" />Loading…</div></div>;

  const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;

  return (
    <div className="app-content dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h1 className="dashboard-hero-title">Welcome back, {user.name}</h1>
          <p className="dashboard-hero-sub">Manage your account and transactions in one place.</p>
        </div>
      </section>

      <div className="dashboard-actions-grid">
        <Link to="/balance" className="dashboard-action-card dashboard-action-card-primary">
          <span className="dashboard-action-icon"><IconBalance /></span>
          <span className="dashboard-action-label">Check balance</span>
          <span className="dashboard-action-desc">View your current balance</span>
        </Link>
        <Link to="/transfer" className="dashboard-action-card">
          <span className="dashboard-action-icon"><IconTransfer /></span>
          <span className="dashboard-action-label">Transfer money</span>
          <span className="dashboard-action-desc">Send to another account</span>
        </Link>
        <Link to="/transactions" className="dashboard-action-card">
          <span className="dashboard-action-icon"><IconHistory /></span>
          <span className="dashboard-action-label">Transaction history</span>
          <span className="dashboard-action-desc">See recent activity</span>
        </Link>
        <Link to="/account" className="dashboard-action-card">
          <span className="dashboard-action-icon"><IconAccount /></span>
          <span className="dashboard-action-label">Account</span>
          <span className="dashboard-action-desc">Profile & details</span>
        </Link>
      </div>

      <div className="dashboard-meta">
        <p className="dashboard-meta-email">{user.email}</p>
        <p className="dashboard-meta-login">
          {lastLogin
            ? `Last login: ${lastLogin.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
            : 'Last login: Just now'}
        </p>
      </div>

      <button
        type="button"
        className="dashboard-chat-fab"
        onClick={() => setChatOpen(true)}
        aria-label="Open Chat with AI"
      >
        <IconChat />
        <span>Chat with AI</span>
      </button>

      {chatOpen && (
        <>
          <div className="chat-fullscreen-backdrop" onClick={() => setChatOpen(false)} aria-hidden="true" />
          <aside className="chat-fullscreen" role="dialog" aria-label="Chat with AI">
            <div className="chat-fullscreen-header">
              <button type="button" className="chat-fullscreen-back" onClick={() => setChatOpen(false)} aria-label="Back to Dashboard">
                <IconBack />
                <span>Back to Dashboard</span>
              </button>
              <h2 className="chat-fullscreen-title">KODBANK Smart Assistant</h2>
              <button type="button" className="chat-fullscreen-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
                <IconClose />
              </button>
            </div>
            <div className="chat-fullscreen-body">
              <ChatFullscreen />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

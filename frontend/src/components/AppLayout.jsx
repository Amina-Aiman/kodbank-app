import { Link, useLocation } from 'react-router-dom';

const APP_NAME = 'KODBANK';

const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const IconWallet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M16 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
  </svg>
);

const IconTransfer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m7 17 5-5-5-5" />
    <path d="m17 7-5 5 5 5" />
  </svg>
);

const IconList = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);

const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function AppLayout({ user, onLogout, children }) {
  const location = useLocation();

  function isActive(path) {
    return location.pathname === path ? ' active' : '';
  }

  return (
    <div className="app-layout app-layout-sidebar">
      <aside className="app-sidebar">
        <div className="app-sidebar-inner">
          <div className="app-sidebar-menu">
            <Link to="/dashboard" className={`sidebar-link${isActive('/dashboard')}`}>
              <IconDashboard />
              <span>Dashboard</span>
            </Link>
            <Link to="/balance" className={`sidebar-link${isActive('/balance')}`}>
              <IconWallet />
              <span>Check Balance</span>
            </Link>
            <Link to="/transfer" className={`sidebar-link${isActive('/transfer')}`}>
              <IconTransfer />
              <span>Transfer Money</span>
            </Link>
            <Link to="/transactions" className={`sidebar-link${isActive('/transactions')}`}>
              <IconList />
              <span>Transaction history</span>
            </Link>
            <Link to="/account" className={`sidebar-link${isActive('/account')}`}>
              <IconUser />
              <span>Account</span>
            </Link>
          </div>
          <button type="button" className="sidebar-link sidebar-logout" onClick={onLogout}>
            <IconLogout />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-header-left" aria-hidden="true" />
            <Link to="/dashboard" className="app-brand">
              <span className="app-brand-emoji" aria-hidden="true">🏦</span>
              <span className="app-brand-text">{APP_NAME}</span>
            </Link>
            <div className="app-header-right">
              <span className="app-user-name">{user?.name}</span>
              <span className="app-user-avatar" aria-hidden="true">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>
        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}

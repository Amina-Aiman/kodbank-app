import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMe } from '../api';

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    getMe()
      .then((r) => setUser(r.user))
      .catch(() => navigate('/login'));
  }, [navigate]);

  if (!user) return <div className="app-content">Loading…</div>;

  const displayName = user.name || user.Cname || '—';
  const displayEmail = user.email || '—';
  const displayId = user.customer_id ?? user.Cid ?? '—';
  const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
  const dob = user.dateOfBirth ? new Date(user.dateOfBirth) : null;

  return (
    <div className="app-content page-enter">
      <div className="card animate-in">
        <h1>Account</h1>
        <p className="sub">Your profile and account details</p>
        <dl className="account-details">
          <dt>Name</dt>
          <dd>{displayName}</dd>
          <dt>Email</dt>
          <dd>{displayEmail}</dd>
          {user.address && (
            <>
              <dt>Address</dt>
              <dd>{user.address}</dd>
            </>
          )}
          {dob && (
            <>
              <dt>Date of birth</dt>
              <dd>{dob.toLocaleDateString(undefined, { dateStyle: 'long' })}</dd>
            </>
          )}
          <dt>Customer ID</dt>
          <dd>{displayId}</dd>
          {lastLogin && (
            <>
              <dt>Last login</dt>
              <dd>{lastLogin.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

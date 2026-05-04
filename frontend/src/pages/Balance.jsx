import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBalance } from '../api';

export default function Balance() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getBalance()
      .then((r) => {
        const b = r?.balance;
        const num = (typeof b === 'number' && Number.isFinite(b)) ? b : 500000;
        setBalance(num);
        setError('');
      })
      .catch((err) => {
        setError(err.message);
        setBalance(500000);
      })
      .finally(() => setLoading(false));
  }, []);

  const displayBalance = (typeof balance === 'number' && Number.isFinite(balance)) ? balance : 500000;

  return (
    <div className="app-content page-enter">
      <div className="card animate-in">
        <h1>Check balance</h1>
        <p className="sub">Your current balance</p>
        {error && <div className="error-msg">{error}</div>}
        {loading && (
          <div className="loading-state">
            <span className="loading-dot" aria-hidden="true" />
            <span>Loading…</span>
          </div>
        )}
        {!loading && (
          <div className="balance-card">
            <div className="label">Available balance</div>
            <div className="value">
              ₹ {displayBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              <span className="currency">INR</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

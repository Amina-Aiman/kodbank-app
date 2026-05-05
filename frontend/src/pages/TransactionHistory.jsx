import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTransactions } from '../api';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTransactions()
      .then((r) => setTransactions(r.transactions || []))
      .catch(() => setError('Failed to load transactions.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="app-content page-enter"><div className="loading-state"><span className="loading-dot" />Loading…</div></div>;

  return (
    <div className="app-content page-enter">
      <div className="card animate-in">
        <h1>Transaction history</h1>
        <p className="sub">Sent and received transfers</p>
        {error && <div className="error-msg">{error}</div>}
        {transactions.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-state-icon" aria-hidden="true">📋</span>
            <h3 className="empty-state-title">No transactions yet</h3>
            <p className="empty-state-text">When you send or receive money, your history will show up here.</p>
          </div>
        ) : (
          <ul className="transaction-list">
            {transactions.map((t, i) => (
              <li key={t.id} className={`transaction-item transaction-${t.type} ${i % 2 === 1 ? 'transaction-item-alt' : ''}`}>
                <span className="tx-type">{t.type === 'sent' ? 'Debited' : 'Credited'}</span>
                <span className="tx-party">{t.type === 'sent' ? `To ${t.toName}` : `From ${t.fromName}`}</span>
                <span className="tx-amount">₹ {Number(t.amount).toLocaleString('en-IN')}</span>
                <span className="tx-date">
                  {t.createdAt ? new Date(t.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecipient, transfer } from '../api';
import { normalizeEmail } from '../utils/email';

const MIN_TRANSFER = 1;
const MAX_TRANSFER = 100000;

export default function Transfer() {
  const [toEmail, setToEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const validAmount = amountNum >= MIN_TRANSFER && amountNum <= MAX_TRANSFER;

  async function handleReview(e) {
    e.preventDefault();
    setError('');
    setReceipt(null);
    const email = normalizeEmail(toEmail);
    setToEmail(email);
    if (!email) {
      setError('Enter recipient email.');
      return;
    }
    if (amountNum < MIN_TRANSFER) {
      setError(`Minimum transfer is ₹${MIN_TRANSFER}.`);
      return;
    }
    if (amountNum > MAX_TRANSFER) {
      setError(`Maximum transfer is ₹${MAX_TRANSFER.toLocaleString('en-IN')}.`);
      return;
    }
    setLoading(true);
    try {
      const r = await getRecipient(email);
      setRecipientName(r.name || 'Unknown');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Recipient not found.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setError('');
    setLoading(true);
    try {
      const cleanedEmail = normalizeEmail(toEmail);
      setToEmail(cleanedEmail);
      const r = await transfer(cleanedEmail, amountNum);
      setReceipt({
        toName: r.transferred_to || recipientName || 'Recipient',
        toEmail: cleanedEmail,
        amount: amountNum,
        time: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
        reference: `KN${Date.now()}`,
      });
      setToEmail('');
      setAmount('');
      setRecipientName('');
      setStep(1);
    } catch (err) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleCancelConfirm() {
    setStep(1);
    setRecipientName('');
    setError('');
  }

  function handleNewTransfer() {
    setReceipt(null);
    setError('');
    setStep(1);
  }

  return (
    <div className="app-content page-enter">
      <div className="card animate-in">
        <h1>Transfer money</h1>
        <p className="sub">Send money to another account by email</p>
        {error && <div className="error-msg">{error}</div>}
        {receipt && (
          <div className="transfer-receipt">
            <div className="transfer-receipt-head">
              <div className="transfer-receipt-title">Transaction successful</div>
              <div className="transfer-receipt-time">{receipt.time}</div>
            </div>
            <div className="transfer-receipt-amount">₹{receipt.amount.toLocaleString('en-IN')}</div>
            <div className="transfer-receipt-row">
              <span>Paid to</span>
              <strong>{receipt.toName}</strong>
            </div>
            <div className="transfer-receipt-row">
              <span>Recipient email</span>
              <span>{receipt.toEmail}</span>
            </div>
            <div className="transfer-receipt-row">
              <span>Reference</span>
              <span>{receipt.reference}</span>
            </div>
            <button type="button" className="btn btn-secondary transfer-receipt-btn" onClick={handleNewTransfer}>
              New transfer
            </button>
          </div>
        )}
        {step === 1 ? (
          <form onSubmit={handleReview}>
            <div className="form-group">
              <label>Recipient email</label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                onBlur={(e) => setToEmail(normalizeEmail(e.target.value))}
                placeholder="recipient@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Amount (₹) — min ₹{MIN_TRANSFER}, max ₹{MAX_TRANSFER.toLocaleString('en-IN')}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min={MIN_TRANSFER}
                max={MAX_TRANSFER}
                step="1"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Checking…' : 'Review'}
            </button>
          </form>
        ) : (
          <div className="transfer-confirm">
            <p className="confirm-text">Send ₹{amountNum.toLocaleString('en-IN')} to <strong>{recipientName}</strong>?</p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Sending…' : 'Confirm'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancelConfirm} disabled={loading}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { normalizeEmail } = require('../utils/email');

const router = express.Router();
const MIN_TRANSFER = 1;
const MAX_TRANSFER = 100000;

function resolveUserCid(user) {
  const raw = user?.Cid ?? user?.cid ?? user?.customer_id;
  const cid = Number(raw);
  return Number.isFinite(cid) ? cid : null;
}

async function resolveUserCidSafe(user) {
  const direct = resolveUserCid(user);
  if (direct != null) return direct;

  const email = normalizeEmail(user?.email || '');
  if (!email) return null;

  const row = await pool.query(
    'SELECT `Cid` FROM `BankUser` WHERE email = ?',
    [email]
  );
  if (!row.rows || row.rows.length === 0) return null;

  const cid = Number(row.rows[0].Cid ?? row.rows[0].cid ?? row.rows[0].customer_id);
  return Number.isFinite(cid) ? cid : null;
}

async function resolveRequestCid(req) {
  const fromAuth = Number(req.authCid);
  if (Number.isFinite(fromAuth)) return fromAuth;
  return resolveUserCidSafe(req.user);
}

// GET /api/bank/balance — JWT validated by middleware; return balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const fromId = await resolveRequestCid(req);
    if (fromId == null) {
      return res.status(401).json({ error: 'Session invalid. Please log in again.' });
    }
    const r = await pool.query(
      'SELECT balance FROM `BankUser` WHERE `Cid` = ?',
      [fromId]
    );
    const raw = r.rows[0]?.balance ?? 500000;
    const balance = (typeof raw === 'number' && Number.isFinite(raw)) ? raw : 500000;
    res.json({ balance, currency: 'INR' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance.' });
  }
});

// GET /api/bank/recipient?email= — get recipient name for confirmation (no transfer)
router.get('/recipient', requireAuth, async (req, res) => {
  const email = normalizeEmail(req.query.email || '');
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const fromId = await resolveRequestCid(req);
    if (fromId == null) {
      return res.status(401).json({ error: 'Session invalid. Please log in again.' });
    }
    const r = await pool.query(
      'SELECT `Cid`, `Cname` FROM `BankUser` WHERE email = ?',
      [email]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Recipient not found.' });
    if (Number(r.rows[0].Cid) === fromId) return res.status(404).json({ error: 'Cannot send to yourself.' });
    res.json({ name: r.rows[0].Cname });
  } catch (err) {
    res.status(500).json({ error: 'Failed to look up recipient.' });
  }
});

// GET /api/bank/transactions — transaction history for current user
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const fromId = await resolveRequestCid(req);
    if (fromId == null) {
      return res.status(401).json({ error: 'Session invalid. Please log in again.' });
    }
    if (typeof pool.getTransactions !== 'function') {
      return res.json({ transactions: [] });
    }
    const transactions = await pool.getTransactions(fromId);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load transactions.', transactions: [] });
  }
});

// POST /api/bank/transfer — transfer money to another customer by email
router.post('/transfer', requireAuth, async (req, res) => {
  const { to_email, amount } = req.body;
  const toEmailNorm = normalizeEmail(to_email || '');
  const amountNum = parseFloat(amount);
  if (!toEmailNorm || !Number.isFinite(amountNum)) {
    return res.status(400).json({ error: 'Valid email and amount are required.' });
  }
  if (amountNum < MIN_TRANSFER) {
    return res.status(400).json({ error: `Minimum transfer amount is ₹${MIN_TRANSFER}.` });
  }
  if (amountNum > MAX_TRANSFER) {
    return res.status(400).json({ error: `Maximum transfer per transaction is ₹${MAX_TRANSFER.toLocaleString('en-IN')} in this simulation.` });
  }
  const fromId = await resolveRequestCid(req);
  if (fromId == null) {
    return res.status(401).json({ error: 'Session invalid. Please log in again.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const fromRow = await conn.query(
      'SELECT balance FROM `BankUser` WHERE `Cid` = ? FOR UPDATE',
      [fromId]
    );
    if (fromRow.rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Your account not found.' });
    }
    const fromBalance = Number(fromRow.rows[0].balance);
    if (fromBalance < amountNum) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance.' });
    }
    const toRow = await conn.query(
      'SELECT `Cid`, `Cname` FROM `BankUser` WHERE email = ? FOR UPDATE',
      [toEmailNorm]
    );
    if (toRow.rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Recipient account not found.' });
    }
    const toId = toRow.rows[0].Cid;
    if (toId === fromId) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cannot transfer to yourself.' });
    }
    await conn.query(
      'UPDATE `BankUser` SET balance = balance - ? WHERE `Cid` = ?',
      [amountNum, fromId]
    );
    await conn.query(
      'UPDATE `BankUser` SET balance = balance + ? WHERE `Cid` = ?',
      [amountNum, toId]
    );
    await conn.commit();
    const toName = toRow.rows[0].Cname;
    const fromName = req.user.Cname || req.user.name;
    if (typeof pool.recordTransaction === 'function') {
      try {
        await pool.recordTransaction(fromId, toId, amountNum, toName, fromName);
      } catch (_) {}
    }
    const newBalanceRow = await pool.query(
      'SELECT balance FROM `BankUser` WHERE `Cid` = ?',
      [fromId]
    );
    res.json({
      message: 'Transfer successful.',
      new_balance: Number(newBalanceRow.rows[0].balance),
      transferred_to: toName,
      amount: amountNum,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ error: 'Transfer failed. Please try again.' });
  } finally {
    conn.release();
  }
});

module.exports = router;

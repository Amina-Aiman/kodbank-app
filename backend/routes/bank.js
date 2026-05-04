const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const MIN_TRANSFER = 1;
const MAX_TRANSFER = 100000;

// GET /api/bank/balance — JWT validated by middleware; return balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT balance FROM `BankUser` WHERE `Cid` = ?',
      [req.user.Cid]
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
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const r = await pool.query(
      'SELECT `Cid`, `Cname` FROM `BankUser` WHERE email = ?',
      [email]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Recipient not found.' });
    if (r.rows[0].Cid === req.user.Cid) return res.status(404).json({ error: 'Cannot send to yourself.' });
    res.json({ name: r.rows[0].Cname });
  } catch (err) {
    res.status(500).json({ error: 'Failed to look up recipient.' });
  }
});

// GET /api/bank/transactions — transaction history for current user
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    if (typeof pool.getTransactions !== 'function') {
      return res.json({ transactions: [] });
    }
    const transactions = await pool.getTransactions(req.user.Cid);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load transactions.', transactions: [] });
  }
});

// POST /api/bank/transfer — transfer money to another customer by email
router.post('/transfer', requireAuth, async (req, res) => {
  const { to_email, amount } = req.body;
  const amountNum = parseFloat(amount);
  if (!to_email || !Number.isFinite(amountNum)) {
    return res.status(400).json({ error: 'Valid email and amount are required.' });
  }
  if (amountNum < MIN_TRANSFER) {
    return res.status(400).json({ error: `Minimum transfer amount is ₹${MIN_TRANSFER}.` });
  }
  if (amountNum > MAX_TRANSFER) {
    return res.status(400).json({ error: `Maximum transfer per transaction is ₹${MAX_TRANSFER.toLocaleString('en-IN')} in this simulation.` });
  }
  const fromId = req.user.Cid;
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
      [to_email.trim().toLowerCase()]
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

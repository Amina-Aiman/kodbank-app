const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRY_DAYS = parseInt(process.env.JWT_EXPIRY_DAYS || '7', 10);
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword, address, dateOfBirth } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Password and confirm password do not match.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const emailNorm = email.trim().toLowerCase();
  const addressVal = address != null ? String(address).trim() : null;
  const dobVal = dateOfBirth != null ? String(dateOfBirth).trim() || null : null;
  try {
    const r = await pool.query(
      'INSERT INTO `BankUser` (`Cname`, email, `Cpwd`, balance, address, dateOfBirth) VALUES (?, ?, ?, 500000, ?, ?)',
      [name.trim(), emailNorm, hash, addressVal, dobVal]
    );
    const insertId = r.insertId != null ? Number(r.insertId) : null;
    if (insertId == null) {
      console.error('Register: INSERT did not return insertId', r);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
    const selectRow = await pool.query(
      'SELECT `Cid`, `Cname`, email, balance FROM `BankUser` WHERE `Cid` = ?',
      [insertId]
    );
    const user = selectRow.rows[0];
    if (!user) {
      console.error('Register: no user row after INSERT, insertId=', insertId);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
    res.status(201).json({
      message: 'Registration successful.',
      user: {
        customer_id: user.Cid,
        name: user.Cname,
        email: user.email,
        balance: user.balance,
      },
    });
  } catch (err) {
    const msg = err.sqlMessage || err.message || String(err);
    const code = err.code || err.errno;
    console.error('Register error:', code, msg);
    if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Database not ready. Run in backend folder: npm run init-db' });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Cannot connect to database. Check DATABASE_URL and network.' });
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045) {
      return res.status(503).json({
        error: 'Database access denied. Update the password in backend/.env (DATABASE_URL). In Aiven Console open your MySQL service → Overview → reveal password and paste it in .env.',
        detail: msg,
      });
    }
    return res.status(500).json({
      error: 'Registration failed. Please try again.',
      detail: msg,
      code: code,
    });
  }
});

// POST /api/auth/login — generates JWT, stores in DB, sets cookie
router.post('/login', async (req, res) => {
  const email = req.body.email != null ? String(req.body.email) : '';
  const password = req.body.password != null ? String(req.body.password) : '';
  if (!email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const emailNorm = email.trim().toLowerCase().replace(/\s+/g, ' ');
    const passwordNorm = password.trim();
    const r = await pool.query(
      'SELECT `Cid`, `Cname`, email, balance, `Cpwd`, lastLogin FROM `BankUser` WHERE email = ? ORDER BY `Cid` DESC',
      [emailNorm]
    );
    if (!r.rows || r.rows.length === 0) {
      return res.status(404).json({ error: 'No account found. Please create an account first.' });
    }
    // If duplicates exist (e.g. local file store), prefer the most recent (highest Cid).
    const user = r.rows.reduce((best, cur) => {
      const bestId = best && best.Cid != null ? Number(best.Cid) : -1;
      const curId = cur && cur.Cid != null ? Number(cur.Cid) : -1;
      return curId > bestId ? cur : best;
    }, r.rows[0]);
    const hash = user.Cpwd || user.cpwd;
    if (!hash || typeof hash !== 'string') {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    let match = false;
    try {
      match = await bcrypt.compare(passwordNorm, hash);
    } catch (_) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const nowIso = new Date().toISOString();
    try {
      await pool.query('UPDATE `BankUser` SET lastLogin = ? WHERE `Cid` = ?', [nowIso, user.Cid]);
    } catch (_) {}
    const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const token = jwt.sign(
      { cid: user.Cid },
      JWT_SECRET,
      { expiresIn: `${JWT_EXPIRY_DAYS}d` }
    );
    await pool.query(
      'INSERT INTO `BankUserJwt` (tokenvalue, `Cid`, `exp`) VALUES (?, ?, ?)',
      [token, user.Cid, expiresAt]
    );
    res.cookie('kodbank_token', token, COOKIE_OPTIONS);
    res.json({
      message: 'Login successful.',
      user: {
        customer_id: user.Cid,
        name: user.Cname,
        email: user.email,
        balance: user.balance,
        lastLogin: user.lastLogin || nowIso,
      },
    });
  } catch (err) {
    console.error('Login error:', err.code || err.errno, err.message, err.sqlMessage);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Database not ready. Run in backend folder: npm run init-db' });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Cannot connect to database. Check DATABASE_URL and network.' });
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045) {
      return res.status(503).json({ error: 'Database access denied. Update the password in backend/.env (DATABASE_URL) from Aiven Console.' });
    }
    return res.status(500).json({ error: 'Login failed. Please try again.', detail: err.sqlMessage || err.message });
  }
});

// POST /api/auth/logout — remove cookie; if token present, delete from DB too
router.post('/logout', async (req, res) => {
  const token = req.cookies?.kodbank_token;
  if (token) {
    try {
      await pool.query('DELETE FROM `BankUserJwt` WHERE tokenvalue = ?', [token]);
    } catch (_) {}
  }
  res.clearCookie('kodbank_token', { path: '/', httpOnly: true });
  res.json({ message: 'Logged out.' });
});

// GET /api/auth/me — current user (validates JWT from cookie)
router.get('/me', requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    user: {
      customer_id: u.Cid,
      name: u.Cname,
      email: u.email,
      balance: u.balance,
      lastLogin: u.lastLogin || u.last_login || null,
      address: u.address || null,
      dateOfBirth: u.dateOfBirth || u.date_of_birth || null,
    },
  });
});

module.exports = router;

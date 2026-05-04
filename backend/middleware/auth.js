const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Validates JWT from cookie, loads user, attaches to req.user.
 * Token must exist in BankUserJwt and not be expired.
 */
async function requireAuth(req, res, next) {
  const token = req.cookies?.kodbank_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
  try {
    const tokenRow = await pool.query(
      'SELECT `Cid` FROM `BankUserJwt` WHERE tokenvalue = ? AND `exp` > NOW()',
      [token]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
    const userRow = await pool.query(
      'SELECT `Cid`, `Cname`, email, balance, address, dateOfBirth FROM `BankUser` WHERE `Cid` = ?',
      [decoded.cid]
    );
    if (userRow.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    req.user = userRow.rows[0];
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed.' });
  }
}

module.exports = { requireAuth };

require('dotenv').config();

const path = require('path');
const fs = require('fs');

/** Local JSON store: explicit USE_SQLITE=1, or Vercel without MySQL env. */
function shouldUseFileStore() {
  if (process.env.USE_SQLITE === '1' || process.env.USE_SQLITE === 'true') return true;
  if (process.env.USE_SQLITE === '0' || process.env.USE_SQLITE === 'false') return false;
  const onVercel = !!(process.env.VERCEL || process.env.VERCEL_URL);
  const hasMysql = !!(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER));
  return onVercel && !hasMysql;
}

const USE_SQLITE = shouldUseFileStore();
const bundledDataPath = path.join(__dirname, '..', 'kodbank-data.json');
const { normalizeEmail: normalizeStoredEmail } = require('../utils/email');

function getDataPath() {
  if (process.env.VERCEL || process.env.VERCEL_URL) {
    return path.join('/tmp', 'kodbank-data.json');
  }
  return bundledDataPath;
}

if (USE_SQLITE) {
  const dataPath = getDataPath();

  function ensureDataFile() {
    if (fs.existsSync(dataPath)) return;
    if (dataPath !== bundledDataPath && fs.existsSync(bundledDataPath)) {
      try {
        fs.copyFileSync(bundledDataPath, dataPath);
        return;
      } catch (_) {}
    }
    fs.writeFileSync(dataPath, JSON.stringify(emptyStore(), null, 2), 'utf8');
  }

  function emptyStore() {
    return { users: [], tokens: [], transactions: [], nextCid: 1, nextTokenId: 1, nextTxId: 1 };
  }

  function readStoreAt(filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.transactions)) data.transactions = [];
      if (!Array.isArray(data.users)) data.users = [];
      data.users.forEach((u) => { if (u.lastLogin === undefined) u.lastLogin = null; });
      return data;
    } catch (e) {
      return null;
    }
  }

  function mergeStores(bundled, primary) {
    const usersByEmail = new Map();
    for (const u of bundled.users) {
      const key = normalizeStoredEmail(u.email);
      if (key) usersByEmail.set(key, u);
    }
    for (const u of primary.users) {
      const key = normalizeStoredEmail(u.email);
      if (key) usersByEmail.set(key, u);
    }
    const maxUserCid = Math.max(0, ...[...usersByEmail.values()].map((u) => Number(u.Cid) || 0));
    return {
      users: Array.from(usersByEmail.values()),
      tokens: (primary.tokens && primary.tokens.length) ? primary.tokens : (bundled.tokens || []),
      transactions: (primary.transactions && primary.transactions.length)
        ? primary.transactions
        : (bundled.transactions || []),
      nextCid: Math.max(Number(primary.nextCid) || 1, Number(bundled.nextCid) || 1, maxUserCid + 1),
      nextTokenId: Math.max(Number(primary.nextTokenId) || 1, Number(bundled.nextTokenId) || 1),
      nextTxId: Math.max(Number(primary.nextTxId) || 1, Number(bundled.nextTxId) || 1),
    };
  }

  function load() {
    ensureDataFile();
    const primary = readStoreAt(dataPath) || emptyStore();
    if (dataPath === bundledDataPath) return primary;
    const bundled = readStoreAt(bundledDataPath);
    if (!bundled) return primary;
    return mergeStores(bundled, primary);
  }

  function findUsersByEmail(data, email) {
    const want = normalizeStoredEmail(email);
    if (!want) return [];
    return data.users.filter((u) => normalizeStoredEmail(u.email) === want);
  }

  function isLookupByEmail(sqlUpper) {
    return (
      sqlUpper.includes('BANKUSER')
      && sqlUpper.includes('EMAIL')
      && (sqlUpper.includes('EMAIL =') || sqlUpper.includes('EMAIL='))
      && !sqlUpper.includes('BANKUSERJWT')
    );
  }

  function isLookupByCid(sqlUpper) {
    return (
      sqlUpper.includes('BANKUSER')
      && (sqlUpper.includes('WHERE CID =') || sqlUpper.includes('WHERE CID='))
      && !sqlUpper.includes('EMAIL =')
      && !sqlUpper.includes('EMAIL=')
    );
  }

  function save(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  }

  function runQuery(data, sql, params) {
    const s = sql.replace(/`/g, '').trim().toUpperCase();
    const p = params || [];

    if (s.startsWith('SELECT')) {
      if (s.includes('BANKUSERJWT') && s.includes('TOKENVALUE') && s.includes('EXP')) {
        const token = data.tokens.find((t) => t.tokenvalue === p[0] && new Date(t.exp) > new Date());
        return { rows: token ? [{ Cid: token.Cid }] : [], insertId: undefined };
      }
      if (isLookupByEmail(s)) {
        const matches = findUsersByEmail(data, p[0]);
        const rows = matches.map((user) => ({
          Cid: user.Cid,
          Cname: user.Cname,
          email: user.email,
          balance: user.balance,
          Cpwd: user.Cpwd,
          lastLogin: user.lastLogin,
        }));
        return { rows, insertId: undefined };
      }
      if (s.includes('BALANCE') && s.includes('BANKUSER')) {
        const user = data.users.find((u) => u.Cid === p[0] || u.Cid === Number(p[0]));
        const raw = user ? user.balance : undefined;
        const num = (typeof raw === 'number' && Number.isFinite(raw)) ? raw : 500000;
        return { rows: user ? [{ balance: num }] : [], insertId: undefined };
      }
      if (isLookupByCid(s)) {
        const user = data.users.find((u) => u.Cid === p[0] || u.Cid === Number(p[0]));
        return { rows: user ? [user] : [], insertId: undefined };
      }
      return { rows: [], insertId: undefined };
    }

    if (s.startsWith('INSERT INTO BANKUSERJWT')) {
      const [tokenvalue, Cid, exp] = p;
      const tokenid = data.nextTokenId++;
      data.tokens.push({ tokenid, tokenvalue, Cid, exp: exp instanceof Date ? exp.toISOString() : exp });
      return { rows: [], insertId: tokenid };
    }

    if (s.startsWith('INSERT INTO BANKUSER')) {
      const Cname = p[0];
      const email = p[1];
      const Cpwd = p[2];
      /**
       * MySQL registrations use literals for balance like:
       * INSERT ... VALUES (?, ?, ?, 500000, ?, ?)
       *
       * So params from auth.register are strictly:
       * [name, email, hash, address, dob]
       */
      const balanceVal = 500000;
      const address = p[3] != null ? String(p[3]).trim() || null : null;
      const dateOfBirth = p[4] != null ? String(p[4]).trim() || null : null;
      const emailNorm = email != null ? String(email).trim().toLowerCase().replace(/\s+/g, ' ') : '';
      if (data.users.some((u) => (u.email != null ? String(u.email).trim().toLowerCase().replace(/\s+/g, ' ') : '') === emailNorm)) {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        err.errno = 1062;
        throw err;
      }
      const Cid = data.nextCid++;
      data.users.push({
        Cid,
        Cname,
        email: emailNorm || email,
        Cpwd,
        balance: balanceVal,
        address: address || null,
        dateOfBirth: dateOfBirth || null,
      });
      return { rows: [], insertId: Cid };
    }

    if (s.startsWith('DELETE FROM BANKUSERJWT')) {
      data.tokens = data.tokens.filter((t) => t.tokenvalue !== p[0]);
      return { rows: [], insertId: undefined };
    }

    if (s.startsWith('UPDATE BANKUSER') && s.includes('BALANCE -')) {
      const [amount, Cid] = p;
      const u = data.users.find((x) => x.Cid === Cid);
      if (u) u.balance = Number(u.balance) - Number(amount);
      return { rows: [], insertId: undefined };
    }

    if (s.startsWith('UPDATE BANKUSER') && s.includes('BALANCE +')) {
      const [amount, Cid] = p;
      const u = data.users.find((x) => x.Cid === Cid);
      if (u) u.balance = Number(u.balance) + Number(amount);
      return { rows: [], insertId: undefined };
    }

    if (s.startsWith('UPDATE BANKUSER') && s.includes('LASTLOGIN')) {
      const [lastLogin, Cid] = p;
      const u = data.users.find((x) => x.Cid === Cid || x.Cid === Number(Cid));
      if (u) u.lastLogin = lastLogin;
      return { rows: [], insertId: undefined };
    }

    return { rows: [], insertId: undefined };
  }

  const pool = {
    async query(sql, params = []) {
      const data = load();
      const result = runQuery(data, sql, params);
      if (!sql.trim().toUpperCase().startsWith('SELECT')) save(data);
      return result;
    },
    async getConnection() {
      const data = load();
      return {
        async query(sql, params = []) {
          return runQuery(data, sql, params);
        },
        beginTransaction: () => {},
        commit: () => save(data),
        rollback: () => {},
        release: () => {},
        _data: data,
      };
    },
    async recordTransaction(fromCid, toCid, amount, toName, fromName) {
      const data = load();
      const id = (data.nextTxId = (data.nextTxId || 1) + 1) - 1;
      data.transactions.push({
        id,
        fromCid,
        toCid,
        amount: Number(amount),
        toName: toName || '',
        fromName: fromName || '',
        createdAt: new Date().toISOString(),
      });
      save(data);
    },
    async getTransactions(cid) {
      const data = load();
      const list = (data.transactions || [])
        .filter((t) => t.fromCid === cid || t.toCid === cid)
        .map((t) => ({
          id: t.id,
          amount: t.amount,
          toName: t.toName,
          fromName: t.fromName,
          createdAt: t.createdAt,
          type: t.fromCid === cid ? 'sent' : 'received',
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return list;
    },
  };

  console.log('Using local file store at', dataPath);
  module.exports = { pool };
} else {
const mysql = require('mysql2/promise');

function parseDbUrl(url) {
  if (!url) return {};
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '3306', 10),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '').split('?')[0] || 'defaultdb',
      ssl: url.includes('ssl-mode=REQUIRED') ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  } catch (e) {
    return {};
  }
}

function getConfig() {
  if (process.env.DB_HOST && process.env.DB_USER) {
    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'defaultdb',
      ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }
  return parseDbUrl(process.env.DATABASE_URL);
}

const config = getConfig();
if (!config.host || !config.user) {
  console.error('DB config missing: set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD in .env');
}
const rawPool = mysql.createPool(config);

function wrapResult(result) {
  const rows = Array.isArray(result) ? result : [];
  const insertId =
    result != null && (typeof result.insertId === 'number' || typeof result.insertId === 'bigint')
      ? Number(result.insertId)
      : undefined;
  return { rows, insertId };
}

const pool = {
  async query(sql, params = []) {
    const [result] = await rawPool.query(sql, params);
    return wrapResult(result);
  },

  async getConnection() {
    const conn = await rawPool.getConnection();
    return {
      async query(sql, params = []) {
        const [result] = await conn.query(sql, params);
        return wrapResult(result);
      },
      beginTransaction: () => conn.beginTransaction(),
      commit: () => conn.commit(),
      rollback: () => conn.rollback(),
      release: () => conn.release(),
    };
  },
};

module.exports = { pool };
}

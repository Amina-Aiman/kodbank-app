const fs = require('fs');
const path = require('path');
const { normalizeEmail } = require('../utils/email');

const bundledDataPath = path.join(__dirname, '..', 'kodbank-data.json');
const BLOB_PATHNAME = 'kodbank-data.json';

function emptyStore() {
  return { users: [], tokens: [], transactions: [], nextCid: 1, nextTokenId: 1, nextTxId: 1 };
}

function normalizeData(data) {
  const out = data && typeof data === 'object' ? data : emptyStore();
  if (!Array.isArray(out.users)) out.users = [];
  if (!Array.isArray(out.tokens)) out.tokens = [];
  if (!Array.isArray(out.transactions)) out.transactions = [];
  out.users.forEach((u) => {
    if (u.lastLogin === undefined) u.lastLogin = null;
  });
  return out;
}

function readFileStore(filePath) {
  try {
    return normalizeData(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return null;
  }
}

function mergeStores(bundled, primary) {
  const usersByEmail = new Map();
  for (const u of bundled.users) {
    const key = normalizeEmail(u.email);
    if (key) usersByEmail.set(key, u);
  }
  for (const u of primary.users) {
    const key = normalizeEmail(u.email);
    if (key) usersByEmail.set(key, u);
  }
  const maxUserCid = Math.max(0, ...[...usersByEmail.values()].map((u) => Number(u.Cid) || 0));
  return {
    users: Array.from(usersByEmail.values()),
    tokens: primary.tokens?.length ? primary.tokens : bundled.tokens || [],
    transactions: primary.transactions?.length ? primary.transactions : bundled.transactions || [],
    nextCid: Math.max(Number(primary.nextCid) || 1, Number(bundled.nextCid) || 1, maxUserCid + 1),
    nextTokenId: Math.max(Number(primary.nextTokenId) || 1, Number(bundled.nextTokenId) || 1),
    nextTxId: Math.max(Number(primary.nextTxId) || 1, Number(bundled.nextTxId) || 1),
  };
}

function getLocalPath() {
  if (process.env.VERCEL || process.env.VERCEL_URL) {
    return path.join('/tmp', BLOB_PATHNAME);
  }
  return bundledDataPath;
}

function ensureLocalFile(dataPath) {
  if (fs.existsSync(dataPath)) return;
  if (dataPath !== bundledDataPath && fs.existsSync(bundledDataPath)) {
    try {
      fs.copyFileSync(bundledDataPath, dataPath);
      return;
    } catch (_) {}
  }
  fs.writeFileSync(dataPath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}

function loadFromFilesystem() {
  const dataPath = getLocalPath();
  ensureLocalFile(dataPath);
  const primary = readFileStore(dataPath) || emptyStore();
  if (dataPath === bundledDataPath) return primary;
  const bundled = readFileStore(bundledDataPath);
  if (!bundled) return primary;
  return mergeStores(bundled, primary);
}

async function loadFromBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: BLOB_PATHNAME, token });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;
    return normalizeData(JSON.parse(await res.text()));
  } catch (err) {
    console.error('Blob load failed:', err.message || err);
    return null;
  }
}

async function saveToBlob(data) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;
  try {
    const { put } = require('@vercel/blob');
    await put(BLOB_PATHNAME, JSON.stringify(data), {
      access: 'public',
      token,
      addRandomSuffix: false,
    });
    return true;
  } catch (err) {
    console.error('Blob save failed:', err.message || err);
    return false;
  }
}

function isVercelRuntime() {
  return !!(process.env.VERCEL || process.env.VERCEL_URL);
}

async function loadPersistedData() {
  const bundled = readFileStore(bundledDataPath) || emptyStore();

  if (isVercelRuntime()) {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blobData = await loadFromBlob();
      if (blobData) return mergeStores(bundled, blobData);
      await saveToBlob(bundled);
      return bundled;
    }
    return loadFromFilesystem();
  }

  return loadFromFilesystem();
}

async function savePersistedData(data) {
  const normalized = normalizeData(data);
  if (isVercelRuntime() && process.env.BLOB_READ_WRITE_TOKEN) {
    await saveToBlob(normalized);
    return;
  }
  const dataPath = getLocalPath();
  ensureLocalFile(dataPath);
  fs.writeFileSync(dataPath, JSON.stringify(normalized, null, 2), 'utf8');
}

module.exports = {
  loadPersistedData,
  savePersistedData,
  emptyStore,
  mergeStores,
  bundledDataPath,
};

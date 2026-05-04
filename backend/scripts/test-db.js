/**
 * Test database connection and tables. Run: node scripts/test-db.js
 * This prints the REAL error so we can fix it.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

function parseDbUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '3306', 10),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '').split('?')[0] || 'defaultdb',
      ssl: url.includes('ssl-mode=REQUIRED') ? { rejectUnauthorized: false } : undefined,
    };
  } catch (e) {
    console.error('Failed to parse DATABASE_URL:', e.message);
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }
  const config = parseDbUrl(url);
  if (!config || !config.host) {
    console.error('Could not parse DATABASE_URL. Example: mysql://user:pass@host:port/db?ssl-mode=REQUIRED');
    process.exit(1);
  }
  console.log('Connecting to', config.host + ':' + config.port, 'database', config.database);
  try {
    const conn = await mysql.createConnection(config);
    console.log('Connected OK.');
    const [rows] = await conn.query('SHOW TABLES');
    console.log('Tables:', rows.length ? rows.map((r) => Object.values(r)[0]) : '(none)');
    await conn.query('SELECT 1 FROM `BankUser` LIMIT 1');
    console.log('BankUser table exists.');
    await conn.end();
    console.log('Test passed.');
  } catch (err) {
    console.error('Error:', err.code || err.errno, err.message);
    if (err.sqlMessage) console.error('SQL:', err.sqlMessage);
    process.exit(1);
  }
}

main();

/**
 * Creates BankUser and BankUserJwt tables (matching your schema) on Aiven MySQL.
 * Run: node scripts/init-db.js
 */
require('dotenv').config();
const { pool } = require('../db/pool');

async function init() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`BankUser\` (
        \`Cid\`         INT AUTO_INCREMENT PRIMARY KEY,
        \`Cname\`       VARCHAR(255) NOT NULL,
        \`Cpwd\`        VARCHAR(255) NOT NULL,
        balance         DECIMAL(18, 2) NOT NULL DEFAULT 0,
        email           VARCHAR(255) UNIQUE NOT NULL,
        address         VARCHAR(500) NULL,
        dateOfBirth     DATE NULL
      )
    `);
    try {
      await pool.query('ALTER TABLE `BankUser` ADD COLUMN address VARCHAR(500) NULL');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    try {
      await pool.query('ALTER TABLE `BankUser` ADD COLUMN dateOfBirth DATE NULL');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`BankUserJwt\` (
        tokenid     INT AUTO_INCREMENT PRIMARY KEY,
        tokenvalue  VARCHAR(2048) NOT NULL UNIQUE,
        \`Cid\`      INT NOT NULL,
        \`exp\`      DATETIME(6) NOT NULL,
        KEY (\`Cid\`),
        KEY (\`exp\`),
        CONSTRAINT fk_jwt_cid FOREIGN KEY (\`Cid\`) REFERENCES \`BankUser\`(\`Cid\`) ON DELETE CASCADE
      )
    `);
    console.log('Tables BankUser and BankUserJwt created (or already exist).');
  } finally {
    process.exit(0);
  }
}

init().catch((err) => {
  console.error('Init DB failed:', err.message);
  process.exit(1);
});

/**
 * Seeds BankUser with sample data from your schema image:
 * Omkar (om@kod.com) - balance 500000, password: omkar
 * Abhaya (ab@kod.com) - balance 600000, password: Abhay
 * Run: node scripts/seed-data.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataPath = path.join(__dirname, '..', 'kodbank-data.json');

async function seed() {
  let data;
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    data = { users: [], tokens: [], nextCid: 1, nextTokenId: 1 };
  }

  const hashOmkar = await bcrypt.hash('omkar', 10);
  const hashAbhay = await bcrypt.hash('Abhay', 10);

  const omkarExists = data.users.some((u) => (u.email || '').toLowerCase() === 'om@kod.com');
  const abhayaExists = data.users.some((u) => (u.email || '').toLowerCase() === 'ab@kod.com');

  if (!omkarExists) {
    data.users.push({
      Cid: 1,
      Cname: 'Omkar',
      email: 'om@kod.com',
      Cpwd: hashOmkar,
      balance: 500000,
    });
    if (data.nextCid <= 1) data.nextCid = 2;
    console.log('Added Omkar (om@kod.com) with balance 500000, password: omkar');
  } else {
    const u = data.users.find((x) => (x.email || '').toLowerCase() === 'om@kod.com');
    if (u) u.balance = 500000;
    console.log('Updated Omkar balance to 500000');
  }

  if (!abhayaExists) {
    data.users.push({
      Cid: 2,
      Cname: 'Abhaya',
      email: 'ab@kod.com',
      Cpwd: hashAbhay,
      balance: 600000,
    });
    if (data.nextCid <= 2) data.nextCid = 3;
    console.log('Added Abhaya (ab@kod.com) with balance 600000, password: Abhay');
  } else {
    const u = data.users.find((x) => (x.email || '').toLowerCase() === 'ab@kod.com');
    if (u) u.balance = 600000;
    console.log('Updated Abhaya balance to 600000');
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Seed done. Log in with om@kod.com / omkar to see balance 500000.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

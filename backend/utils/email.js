function normalizeEmail(email) {
  return String(email ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

module.exports = { normalizeEmail };

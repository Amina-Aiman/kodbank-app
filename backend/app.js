const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const bankRoutes = require('./routes/bank');
const aiRoutes = require('./routes/ai');

const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = [
  FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
].filter((o, i, a) => a.indexOf(o) === i);

app.use(
  cors({
    origin: (origin, cb) => (allowedOrigins.includes(origin) || !origin ? cb(null, true) : cb(null, false)),
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/ai', aiRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/ai/status', (req, res) => {
  const key = (process.env.HUGGINGFACE_API_KEY || '').trim();
  res.json({ configured: key.length > 0 });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err.message || err);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;


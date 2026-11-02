import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { config } from './config.js';
import { pool } from './db.js';
import { authRouter } from './routes/auth.js';
import { problemsRouter } from './routes/problems.js';
import { adminRouter } from './routes/admin.js';
import { communityRouter } from './routes/community.js';
import { webDist } from './paths.js';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}), authRouter);
app.use('/api/problems', problemsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', communityRouter);

if (config.env === 'production') {
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) return res.sendFile(path.join(webDist, 'index.html'));
    return next();
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Máy chủ gặp lỗi. Vui lòng thử lại.' });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`API Tờ Toán đang chạy tại http://127.0.0.1:${config.port}`);
});

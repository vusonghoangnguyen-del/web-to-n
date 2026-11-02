import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    path: '/',
  };
}

function setSession(res, user) {
  const token = jwt.sign(publicUser(user), config.jwtSecret, { expiresIn: '7d' });
  res.cookie('session', token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (name.length < 2 || name.length > 120 || !validEmail || email.length > 255 || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Tên, email hoặc mật khẩu chưa hợp lệ (mật khẩu tối thiểu 8 ký tự).' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
    );
    const user = { id: result.insertId, name, email, role: 'reader' };
    setSession(res, user);
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email này đã có tài khoản.' });
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password || password.length > 128) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }
    const [rows] = await pool.execute(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = ? AND status = 'active' LIMIT 1",
      [email],
    );
    const account = rows[0];
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }
    setSession(res, account);
    return res.json({ user: publicUser(account) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('session', cookieOptions());
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

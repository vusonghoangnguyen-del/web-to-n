import { Router } from 'express';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    path: '/',
  };
}

const movedMessage = { message: 'Chức năng tài khoản đã chuyển sang /api/v1/auth.' };
authRouter.post('/register', (_req, res) => res.status(410).json(movedMessage));
authRouter.post('/login', (_req, res) => res.status(410).json(movedMessage));

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('session', cookieOptions());
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

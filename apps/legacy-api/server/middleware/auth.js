import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db.js';

export async function requireAuth(req, res, next) {
  const modernToken = req.cookies.to_toan_session;
  if (modernToken) {
    try {
      const tokenHash = crypto.createHash('sha256').update(modernToken).digest('hex');
      const [rows] = await pool.execute(
        `SELECT u.id, u.name, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?
           AND s.revoked_at IS NULL
           AND s.expires_at > CURRENT_TIMESTAMP
           AND u.status = 'active'
           AND u.email_verified_at IS NOT NULL
         LIMIT 1`,
        [tokenHash],
      );
      if (!rows[0]) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
      req.user = rows[0];
      return next();
    } catch (error) {
      return next(error);
    }
  }

  const token = req.cookies.session;
  if (!token) return res.status(401).json({ message: 'Bạn cần đăng nhập.' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, role FROM users WHERE id = ? AND status = 'active' LIMIT 1",
      [payload.id],
    );
    if (!rows[0]) return res.status(401).json({ message: 'Tài khoản không còn hoạt động.' });
    req.user = rows[0];
    return next();
  } catch (error) { return next(error); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập khu vực quản trị.' });
  }
  return next();
}

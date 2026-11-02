import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const communityRouter = Router();

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

communityRouter.get('/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.title, p.content AS body, p.difficulty, p.published_at,
              u.name AS author, c.slug AS tag
         FROM bookmarks b
         JOIN problems p ON p.id = b.problem_id
         JOIN users u ON u.id = p.author_id
    LEFT JOIN problem_categories pc ON pc.problem_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
        WHERE b.user_id = ? AND p.status = 'published'
     ORDER BY b.created_at DESC LIMIT 100`,
      [req.user.id],
    );
    res.json({ bookmarks: rows });
  } catch (error) { next(error); }
});

communityRouter.put('/bookmarks/:id', requireAuth, async (req, res, next) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Bài toán không hợp lệ.' });
  try {
    const [rows] = await pool.execute("SELECT id FROM problems WHERE id = ? AND status = 'published' LIMIT 1", [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Bài toán chưa được xuất bản.' });
    await pool.execute('INSERT IGNORE INTO bookmarks (user_id, problem_id) VALUES (?, ?)', [req.user.id, id]);
    return res.status(204).end();
  } catch (error) { return next(error); }
});

communityRouter.delete('/bookmarks/:id', requireAuth, async (req, res, next) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Bài toán không hợp lệ.' });
  try {
    await pool.execute('DELETE FROM bookmarks WHERE user_id = ? AND problem_id = ?', [req.user.id, id]);
    res.status(204).end();
  } catch (error) { next(error); }
});

communityRouter.get('/videos', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, topic, duration, url, created_at
         FROM videos WHERE status = 'published'
     ORDER BY created_at DESC, id DESC LIMIT 30`,
    );
    res.json({ videos: rows });
  } catch (error) { next(error); }
});

communityRouter.get('/featured-solutions', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, LEFT(s.content, 180) AS excerpt, p.id AS problem_id,
              p.title AS problem_title, u.name AS author_name
         FROM solutions s
         JOIN problems p ON p.id = s.problem_id
         JOIN users u ON u.id = s.author_id
        WHERE s.status = 'verified' AND p.status = 'published'
     ORDER BY s.updated_at DESC, s.id DESC LIMIT 3`,
    );
    res.json({ solutions: rows });
  } catch (error) { next(error); }
});

communityRouter.post('/newsletter', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Email không hợp lệ.' });
  }
  try {
    await pool.execute(
      'INSERT INTO newsletter_subscriptions (email) VALUES (?) ON DUPLICATE KEY UPDATE email = VALUES(email)',
      [email],
    );
    return res.status(201).json({ message: 'Đã ghi nhận email đăng ký.' });
  } catch (error) { return next(error); }
});

import { Router } from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [[users], [problems], [solutions]] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total, SUM(status = 'active') AS active FROM users"),
      pool.query("SELECT COUNT(*) AS total, SUM(status = 'pending') AS pending, SUM(status = 'published') AS published FROM problems"),
      pool.query("SELECT COUNT(*) AS total, SUM(status = 'pending') AS pending FROM solutions"),
    ]);
    res.json({
      stats: {
        users: Number(users[0].total),
        activeUsers: Number(users[0].active || 0),
        problems: Number(problems[0].total),
        pendingProblems: Number(problems[0].pending || 0),
        publishedProblems: Number(problems[0].published || 0),
        solutions: Number(solutions[0].total),
        pendingSolutions: Number(solutions[0].pending || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/problems', async (req, res, next) => {
  const allowed = ['all', 'pending', 'published', 'rejected', 'draft'];
  const status = allowed.includes(req.query.status) ? req.query.status : 'pending';
  const where = status === 'all' ? '' : 'WHERE p.status = ?';
  const params = status === 'all' ? [] : [status];
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.title, p.content, p.source, p.difficulty, p.status, p.created_at, p.updated_at,
              u.id AS author_id, u.name AS author_name, u.email AS author_email,
              GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') AS categories
         FROM problems p
         JOIN users u ON u.id = p.author_id
    LEFT JOIN problem_categories pc ON pc.problem_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
       ${where}
     GROUP BY p.id, u.id
     ORDER BY FIELD(p.status, 'pending', 'draft', 'published', 'rejected'), p.created_at DESC
        LIMIT 100`,
      params,
    );
    res.json({ problems: rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/problems/:id/status', async (req, res, next) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  if (!Number.isSafeInteger(id) || id < 1 || !['pending', 'published', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái bài toán không hợp lệ.' });
  }
  try {
    const [result] = await pool.execute(
      `UPDATE problems
          SET status = ?, published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = ?`,
      [status, status, id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy bài toán.' });
    return res.json({ id, status });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/solutions', async (req, res, next) => {
  const allowed = ['all', 'pending', 'verified', 'rejected'];
  const status = allowed.includes(req.query.status) ? req.query.status : 'pending';
  const where = status === 'all' ? '' : 'WHERE s.status = ?';
  const params = status === 'all' ? [] : [status];
  try {
    const [rows] = await pool.execute(
      `SELECT s.id, s.content, s.status, s.created_at, s.updated_at,
              p.id AS problem_id, p.title AS problem_title,
              u.id AS author_id, u.name AS author_name, u.email AS author_email
         FROM solutions s
         JOIN problems p ON p.id = s.problem_id
         JOIN users u ON u.id = s.author_id
       ${where}
     ORDER BY FIELD(s.status, 'pending', 'verified', 'rejected'), s.created_at DESC
        LIMIT 100`,
      params,
    );
    res.json({ solutions: rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/solutions/:id/status', async (req, res, next) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  if (!Number.isSafeInteger(id) || id < 1 || !['pending', 'verified', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái lời giải không hợp lệ.' });
  }
  try {
    const [result] = await pool.execute('UPDATE solutions SET status = ? WHERE id = ?', [status, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy lời giải.' });
    return res.json({ id, status });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/videos', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.title, v.topic, v.duration, v.url, v.status, v.created_at, u.name AS author_name
         FROM videos v JOIN users u ON u.id = v.author_id
     ORDER BY v.created_at DESC LIMIT 100`,
    );
    res.json({ videos: rows });
  } catch (error) { next(error); }
});

adminRouter.post('/videos', async (req, res, next) => {
  const title = String(req.body?.title || '').trim();
  const topic = String(req.body?.topic || '').trim();
  const duration = String(req.body?.duration || '').trim();
  const url = String(req.body?.url || '').trim();
  let parsed;
  try { parsed = new URL(url); } catch { /* validated below */ }
  if (title.length < 3 || title.length > 255 || topic.length < 2 || topic.length > 80 ||
      !/^\d{1,3}:\d{2}$/.test(duration) || !parsed || !['http:', 'https:'].includes(parsed.protocol) || url.length > 1000) {
    return res.status(400).json({ message: 'Thông tin video chưa hợp lệ.' });
  }
  try {
    const [result] = await pool.execute(
      "INSERT INTO videos (author_id, title, topic, duration, url, status) VALUES (?, ?, ?, ?, ?, 'published')",
      [req.user.id, title, topic, duration, url],
    );
    res.status(201).json({ video: { id: result.insertId, title, topic, duration, url, status: 'published' } });
  } catch (error) { next(error); }
});

adminRouter.delete('/videos/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Video không hợp lệ.' });
  try {
    const [result] = await pool.execute("UPDATE videos SET status = 'rejected' WHERE id = ?", [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy video.' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

adminRouter.get('/comments', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT cm.id, cm.content, cm.created_at, p.id AS problem_id,
              p.title AS problem_title, u.name AS author_name
         FROM comments cm
         JOIN problems p ON p.id = cm.problem_id
         JOIN users u ON u.id = cm.user_id
        WHERE cm.status = 'visible'
     ORDER BY cm.created_at DESC, cm.id DESC LIMIT 100`,
    );
    res.json({ comments: rows });
  } catch (error) { next(error); }
});

adminRouter.delete('/comments/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Bình luận không hợp lệ.' });
  try {
    const [result] = await pool.execute(
      "UPDATE comments SET status = 'hidden', content = '[Bình luận đã được xóa]' WHERE id = ? AND status = 'visible'",
      [id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

adminRouter.get('/users', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
              COUNT(DISTINCT p.id) AS problem_count,
              COUNT(DISTINCT s.id) AS solution_count
         FROM users u
    LEFT JOIN problems p ON p.author_id = u.id
    LEFT JOIN solutions s ON s.author_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC
        LIMIT 200`,
    );
    res.json({ users: rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/users/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const role = String(req.body.role || '');
  const status = String(req.body.status || '');
  if (!Number.isSafeInteger(id) || id < 1 || !['reader', 'editor', 'moderator', 'admin'].includes(role) || !['pending_verification', 'active', 'suspended', 'disabled'].includes(status)) {
    return res.status(400).json({ message: 'Thông tin tài khoản không hợp lệ.' });
  }
  if (id === Number(req.user.id) && (role !== 'admin' || status !== 'active')) {
    return res.status(400).json({ message: 'Bạn không thể tự hạ quyền hoặc vô hiệu hóa tài khoản đang dùng.' });
  }
  try {
    const [result] = await pool.execute(
      "UPDATE users SET role = ?, status = ? WHERE id = ? AND (? <> 'active' OR email_verified_at IS NOT NULL)",
      [role, status, id, status],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    if (status !== 'active') {
      await pool.execute(
        'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [id],
      );
    }
    return res.json({ id, role, status });
  } catch (error) {
    return next(error);
  }
});

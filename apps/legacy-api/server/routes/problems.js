import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const problemsRouter = Router();

function slugBase(title) {
  return title
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240)
    .replace(/-+$/g, '') || 'bai-toan';
}

async function uniqueProblemSlug(connection, title) {
  const base = slugBase(title);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const [rows] = await connection.execute('SELECT id FROM problems WHERE slug = ? LIMIT 1', [slug]);
    if (!rows[0]) return slug;
  }
  throw new Error('Không thể tạo đường dẫn duy nhất cho bài toán.');
}

async function attachCommentCounts(problems) {
  if (!problems.length) return problems;
  try {
    const placeholders = problems.map(() => '?').join(',');
    const [counts] = await pool.execute(
      `SELECT problem_id, COUNT(*) AS total FROM comments WHERE status = 'visible' AND problem_id IN (${placeholders}) GROUP BY problem_id`,
      problems.map((problem) => problem.id),
    );
    const byProblem = new Map(counts.map((row) => [Number(row.problem_id), Number(row.total)]));
    problems.forEach((problem) => { problem.comment_count = byProblem.get(Number(problem.id)) || 0; });
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
    problems.forEach((problem) => { problem.comment_count = 0; });
  }
  return problems;
}

problemsRouter.get('/', async (req, res, next) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const limit = 12;
  const search = String(req.query.search || '').trim().slice(0, 100);
  const category = String(req.query.category || '').trim().slice(0, 80);
  const difficulty = String(req.query.difficulty || '').trim();
  const where = ["p.status = 'published'"];
  const params = [];
  if (search) {
    where.push('(p.title LIKE ? OR p.content LIKE ?)');
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    params.push(pattern, pattern);
  }
  if (category && category !== 'all') {
    where.push('EXISTS (SELECT 1 FROM problem_categories pc2 JOIN categories c2 ON c2.id = pc2.category_id WHERE pc2.problem_id = p.id AND c2.slug = ?)');
    params.push(category);
  }
  if (['Dễ', 'Trung bình', 'Khó', 'Thử thách'].includes(difficulty)) {
    where.push('p.difficulty = ?');
    params.push(difficulty);
  }
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.content AS body, p.difficulty, p.status, p.published_at,
              u.name AS author, GROUP_CONCAT(DISTINCT c.slug ORDER BY c.slug SEPARATOR ' ') AS tags
         FROM problems p
         JOIN users u ON u.id = p.author_id
    LEFT JOIN problem_categories pc ON pc.problem_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
        WHERE ${where.join(' AND ')}
     GROUP BY p.id, u.id
     ORDER BY p.published_at DESC, p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    await attachCommentCounts(rows);
    const [[count]] = await pool.query(
      `SELECT COUNT(*) AS total FROM problems p WHERE ${where.join(' AND ')}`,
      params,
    );
    res.json({ problems: rows, page, total: Number(count.total), hasMore: page * limit < Number(count.total) });
  } catch (error) {
    next(error);
  }
});

problemsRouter.get('/solutions/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.id, s.status, s.created_at, p.id AS problem_id,
              p.title AS problem_title, p.status AS problem_status
         FROM solutions s JOIN problems p ON p.id = s.problem_id
        WHERE s.author_id = ? AND s.status <> 'withdrawn'
     ORDER BY s.created_at DESC LIMIT 100`,
      [req.user.id],
    );
    res.json({ solutions: rows });
  } catch (error) { next(error); }
});

problemsRouter.get('/:id/comments', async (req, res, next) => {
  const problemId = Number(req.params.id);
  if (!Number.isSafeInteger(problemId) || problemId < 1) return res.status(400).json({ message: 'Bài toán không hợp lệ.' });
  try {
    const [rows] = await pool.execute(
      `SELECT cm.id, cm.problem_id, cm.user_id, cm.parent_id,
              CASE WHEN cm.deleted_at IS NULL THEN cm.content ELSE '[Bình luận đã được xóa]' END AS content,
              cm.created_at, cm.updated_at, cm.edited_at, cm.deleted_at,
              u.name AS author_name, u.role AS author_role
         FROM comments cm
         JOIN users u ON u.id = cm.user_id
         JOIN problems p ON p.id = cm.problem_id
        WHERE cm.problem_id = ? AND cm.status = 'visible' AND p.status = 'published'
     ORDER BY cm.created_at ASC, cm.id ASC`,
      [problemId],
    );
    res.json({ comments: rows });
  } catch (error) {
    next(error);
  }
});

problemsRouter.post('/:id/comments', requireAuth, async (req, res, next) => {
  const problemId = Number(req.params.id);
  const parentId = req.body?.parentId ? Number(req.body.parentId) : null;
  const content = String(req.body?.content || '').trim();
  if (!Number.isSafeInteger(problemId) || problemId < 1 || content.length < 2 || content.length > 2000) {
    return res.status(400).json({ message: 'Bình luận phải có từ 2 đến 2.000 ký tự.' });
  }
  if (parentId !== null && (!Number.isSafeInteger(parentId) || parentId < 1)) {
    return res.status(400).json({ message: 'Bình luận được trả lời không hợp lệ.' });
  }
  try {
    const [problems] = await pool.execute("SELECT id FROM problems WHERE id = ? AND status = 'published' LIMIT 1", [problemId]);
    if (!problems[0]) return res.status(404).json({ message: 'Bài toán chưa được xuất bản hoặc không tồn tại.' });
    if (parentId !== null) {
      const [parents] = await pool.execute(
        "SELECT id FROM comments WHERE id = ? AND problem_id = ? AND status = 'visible' LIMIT 1",
        [parentId, problemId],
      );
      if (!parents[0]) return res.status(400).json({ message: 'Không tìm thấy bình luận bạn muốn trả lời.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO comments (problem_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
      [problemId, req.user.id, parentId, content],
    );
    res.status(201).json({
      comment: {
        id: result.insertId,
        problem_id: problemId,
        user_id: req.user.id,
        parent_id: parentId,
        content,
        author_name: req.user.name,
        author_role: req.user.role,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

problemsRouter.delete('/comments/:commentId', requireAuth, async (req, res, next) => {
  const commentId = Number(req.params.commentId);
  if (!Number.isSafeInteger(commentId) || commentId < 1) return res.status(400).json({ message: 'Bình luận không hợp lệ.' });
  try {
    const [rows] = await pool.execute('SELECT user_id FROM comments WHERE id = ? AND status = \'visible\' LIMIT 1', [commentId]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
    if (Number(rows[0].user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này.' });
    }
    await pool.execute(
      'UPDATE comments SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?',
      [req.user.id, commentId],
    );
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

problemsRouter.get('/:id/solutions/mine', requireAuth, async (req, res, next) => {
  const problemId = Number(req.params.id);
  if (!Number.isSafeInteger(problemId) || problemId < 1) return res.status(400).json({ message: 'Bài toán không hợp lệ.' });
  try {
    const [rows] = await pool.execute(
      `SELECT id, problem_id, content, status, created_at, updated_at
         FROM solutions
        WHERE problem_id = ? AND author_id = ? AND status <> 'withdrawn'
     ORDER BY created_at DESC`,
      [problemId, req.user.id],
    );
    res.json({ solutions: rows });
  } catch (error) {
    next(error);
  }
});

problemsRouter.get('/:id/solutions', async (req, res, next) => {
  const problemId = Number(req.params.id);
  if (!Number.isSafeInteger(problemId) || problemId < 1) return res.status(400).json({ message: 'Bài toán không hợp lệ.' });
  try {
    const [rows] = await pool.execute(
      `SELECT s.id, s.problem_id, s.content, s.created_at, s.updated_at,
              u.id AS author_id, u.name AS author_name, u.role AS author_role
         FROM solutions s
         JOIN users u ON u.id = s.author_id
         JOIN problems p ON p.id = s.problem_id
        WHERE s.problem_id = ? AND s.status = 'verified' AND p.status = 'published'
     ORDER BY s.created_at ASC, s.id ASC`,
      [problemId],
    );
    res.json({ solutions: rows });
  } catch (error) {
    next(error);
  }
});

problemsRouter.post('/:id/solutions', requireAuth, async (req, res, next) => {
  const problemId = Number(req.params.id);
  const content = String(req.body?.content || '').trim();
  if (!Number.isSafeInteger(problemId) || problemId < 1 || content.length < 20 || content.length > 10000) {
    return res.status(400).json({ message: 'Lời giải phải có từ 20 đến 10.000 ký tự.' });
  }
  try {
    const [problems] = await pool.execute("SELECT id FROM problems WHERE id = ? AND status = 'published' LIMIT 1", [problemId]);
    if (!problems[0]) return res.status(404).json({ message: 'Bài toán chưa được xuất bản hoặc không tồn tại.' });
    const [existing] = await pool.execute(
      "SELECT id FROM solutions WHERE problem_id = ? AND author_id = ? AND status = 'pending' LIMIT 1",
      [problemId, req.user.id],
    );
    if (existing[0]) return res.status(409).json({ message: 'Bạn đã có một lời giải đang chờ duyệt cho bài này.' });
    const [result] = await pool.execute(
      'INSERT INTO solutions (problem_id, author_id, content) VALUES (?, ?, ?)',
      [problemId, req.user.id, content],
    );
    await pool.execute(
      `INSERT INTO solution_revisions
        (solution_id, editor_id, version, content, status, change_summary)
       VALUES (?, ?, 1, ?, 'pending', ?)`,
      [result.insertId, req.user.id, content, 'Gửi lời giải qua API chuyển tiếp'],
    );
    res.status(201).json({
      solution: { id: result.insertId, problem_id: problemId, content, status: 'pending', created_at: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

problemsRouter.delete('/solutions/:solutionId', requireAuth, async (req, res, next) => {
  const solutionId = Number(req.params.solutionId);
  if (!Number.isSafeInteger(solutionId) || solutionId < 1) return res.status(400).json({ message: 'Lời giải không hợp lệ.' });
  try {
    const [rows] = await pool.execute('SELECT author_id, status FROM solutions WHERE id = ? LIMIT 1', [solutionId]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy lời giải.' });
    if (Number(rows[0].author_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa lời giải này.' });
    }
    await pool.execute(
      `UPDATE solutions
          SET status = 'withdrawn', withdrawn_at = CURRENT_TIMESTAMP,
              is_featured = 0, featured_at = NULL, featured_by = NULL
        WHERE id = ?`,
      [solutionId],
    );
    await pool.execute(
      `INSERT INTO solution_revisions
        (solution_id, editor_id, version, content, status, change_summary)
       SELECT id, ?,
              (SELECT COALESCE(MAX(sr.version), 0) + 1 FROM solution_revisions sr WHERE sr.solution_id = solutions.id),
              content, status, ?
         FROM solutions WHERE id = ?`,
      [req.user.id, 'Rút lời giải qua API chuyển tiếp', solutionId],
    );
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

problemsRouter.get('/detail/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Bài toán không hợp lệ.' });
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.title, p.content AS body, p.source, p.difficulty, p.published_at,
              u.name AS author, GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') AS categories
         FROM problems p
         JOIN users u ON u.id = p.author_id
    LEFT JOIN problem_categories pc ON pc.problem_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
        WHERE p.id = ? AND p.status = 'published'
     GROUP BY p.id, u.id
        LIMIT 1`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ message: 'Bài toán chưa được xuất bản hoặc không tồn tại.' });
    await attachCommentCounts(rows);
    return res.json({ problem: rows[0] });
  } catch (error) {
    return next(error);
  }
});

problemsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.title, p.content AS body, p.difficulty, p.status, p.created_at,
              u.name AS author, GROUP_CONCAT(DISTINCT c.slug ORDER BY c.slug SEPARATOR ' ') AS tags
         FROM problems p
         JOIN users u ON u.id = p.author_id
    LEFT JOIN problem_categories pc ON pc.problem_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
        WHERE p.author_id = ?
     GROUP BY p.id, u.id
     ORDER BY p.created_at DESC`,
      [req.user.id],
    );
    res.json({ problems: rows });
  } catch (error) {
    next(error);
  }
});

problemsRouter.post('/', requireAuth, async (req, res, next) => {
  const title = String(req.body?.title || '').trim();
  const content = String(req.body?.body || '').trim();
  const tag = String(req.body?.tag || '').trim();
  const difficulty = String(req.body?.difficulty || 'Trung bình');
  const source = String(req.body?.source || '').trim() || null;
  const allowedDifficulty = ['Dễ', 'Trung bình', 'Khó', 'Thử thách'];
  if (title.length < 5 || title.length > 255 || content.length < 10 || content.length > 30000 ||
      source?.length > 500 || !allowedDifficulty.includes(difficulty)) {
    return res.status(400).json({ message: 'Tiêu đề, đề bài hoặc độ khó chưa hợp lệ.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const slug = await uniqueProblemSlug(connection, title);
    const [result] = await connection.execute(
      'INSERT INTO problems (author_id, title, slug, content, source, difficulty) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, title, slug, content, source, difficulty],
    );
    const [categories] = await connection.execute('SELECT id FROM categories WHERE slug = ? LIMIT 1', [tag]);
    if (!categories[0]) {
      await connection.rollback();
      return res.status(400).json({ message: 'Chuyên mục không hợp lệ.' });
    }
    await connection.execute(
      'INSERT INTO problem_categories (problem_id, category_id) VALUES (?, ?)',
      [result.insertId, categories[0].id],
    );
    await connection.execute(
      `INSERT INTO problem_revisions
        (problem_id, editor_id, version, title, content, source, difficulty, status, category_slugs, change_summary)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'pending', JSON_ARRAY(?), ?)`,
      [result.insertId, req.user.id, title, content, source, difficulty, tag, 'Tạo bài toán qua API chuyển tiếp'],
    );
    await connection.commit();
    res.status(201).json({
      problem: { id: result.insertId, title, body: content, tags: tag, difficulty, status: 'pending', author: req.user.name },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

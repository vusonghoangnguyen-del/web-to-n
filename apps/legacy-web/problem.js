const $ = (selector, root = document) => root.querySelector(selector);
const problemId = Number(new URLSearchParams(location.search).get('id'));
const toast = $('#problem-toast');
let currentUser = null;
let comments = [];
let verifiedSolutions = [];
let mySolutions = [];
let replyTo = null;
let isBookmarked = false;
let toastTimer;

function escapeHTML(value) { const element = document.createElement('div'); element.textContent = value ?? ''; return element.innerHTML; }
function safeURL(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3400); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data?.message || 'Không thể kết nối tới máy chủ.'); error.status = response.status; throw error; }
  return data;
}
function formatDate(value) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function roleLabel(role) { return { admin: 'Admin', editor: 'Biên tập viên', reader: 'Thành viên' }[role] || 'Thành viên'; }

function renderProblem(problem) {
  document.title = `${problem.title} — Tờ Toán`;
  $('#problem-title').textContent = problem.title;
  $('#problem-statement').textContent = problem.body;
  $('#problem-byline').textContent = `Bài của ${problem.author} · Xuất bản ${formatDate(problem.published_at)}`;
  $('#problem-meta').innerHTML = `<span>${escapeHTML(problem.categories || 'Chưa phân loại')}</span><span>${escapeHTML(problem.difficulty)}</span>`;
  const source = safeURL(problem.source);
  if (source) { $('#problem-source').href = source; $('#problem-source').hidden = false; }
  $('#problem-loading').hidden = true;
  $('#problem-page').hidden = false;
}

function renderBookmark() {
  $('#detail-bookmark').textContent = isBookmarked ? '★ Đã lưu bài toán' : '☆ Lưu bài toán';
  $('#detail-bookmark').setAttribute('aria-pressed', String(isBookmarked));
}
$('#detail-bookmark').addEventListener('click', async () => {
  if (!currentUser) { location.assign(`/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`); return; }
  const button = $('#detail-bookmark');
  button.disabled = true;
  try {
    await api(`/api/bookmarks/${problemId}`, { method: isBookmarked ? 'DELETE' : 'PUT' });
    isBookmarked = !isBookmarked;
    renderBookmark();
    notify(isBookmarked ? 'Đã lưu bài toán vào hồ sơ.' : 'Đã bỏ lưu bài toán.');
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
});

function renderComments() {
  $('#comment-count').textContent = `${comments.length} bình luận`;
  const list = $('#comments-list');
  if (!comments.length) { list.innerHTML = '<p class="discussion-empty">Chưa có bình luận. Hãy là người đầu tiên mở một hướng suy nghĩ.</p>'; return; }
  const byId = new Map(comments.map((comment) => [Number(comment.id), comment]));
  const roots = comments.filter((comment) => !comment.parent_id || !byId.has(Number(comment.parent_id)));
  const replies = new Map(roots.map((root) => [Number(root.id), []]));
  comments.filter((comment) => !roots.includes(comment)).forEach((comment) => {
    let parent = byId.get(Number(comment.parent_id));
    while (parent?.parent_id && byId.has(Number(parent.parent_id))) parent = byId.get(Number(parent.parent_id));
    if (parent) (replies.get(Number(parent.id)) || []).push(comment);
  });
  const renderOne = (comment, isReply = false) => {
    const canDelete = currentUser && (Number(currentUser.id) === Number(comment.user_id) || currentUser.role === 'admin');
    return `<article class="comment${isReply ? ' reply' : ''}" data-comment-id="${comment.id}"><div class="comment-avatar">${escapeHTML(comment.author_name.slice(0, 1))}</div><div><div class="comment-head"><strong>${escapeHTML(comment.author_name)}</strong><span class="comment-role">${escapeHTML(roleLabel(comment.author_role))}</span><span class="comment-time">${escapeHTML(formatDate(comment.created_at))}</span></div><p class="comment-content">${escapeHTML(comment.content)}</p><div class="comment-actions">${currentUser ? `<button type="button" data-reply>Trả lời</button>` : ''}${canDelete ? '<button type="button" class="delete-comment" data-delete>Xóa</button>' : ''}</div></div></article>`;
  };
  list.innerHTML = roots.map((root) => renderOne(root) + (replies.get(Number(root.id)) || []).map((reply) => renderOne(reply, true)).join('')).join('');
}

function solutionStatusLabel(status) {
  return { pending: 'Chờ tòa soạn duyệt', verified: 'Đã kiểm chứng', rejected: 'Đã từ chối' }[status] || status;
}

function renderVerifiedSolutions() {
  $('#verified-solution-count').textContent = `${verifiedSolutions.length} lời giải đã kiểm chứng`;
  const list = $('#verified-solutions');
  if (!verifiedSolutions.length) {
    list.innerHTML = '<p class="solutions-empty">Chưa có lời giải nào được kiểm chứng. Bạn có thể gửi một cách giải mới.</p>';
    return;
  }
  list.innerHTML = verifiedSolutions.map((solution, index) => `<article class="verified-solution"><span class="verified-solution-meta">Lời giải ${String(index + 1).padStart(2, '0')} · ${escapeHTML(solution.author_name)} · ${escapeHTML(formatDate(solution.created_at))}</span><h3>Một cách tiếp cận từ cộng đồng</h3><div class="verified-solution-content">${escapeHTML(solution.content)}</div></article>`).join('');
}

function renderMySolutions() {
  const container = $('#my-solutions');
  $('#detail-solution-form').hidden = !currentUser || mySolutions.some((solution) => solution.status === 'pending');
  if (!currentUser || !mySolutions.length) { container.innerHTML = ''; return; }
  container.innerHTML = mySolutions.map((solution) => `<article class="my-solution" data-solution-id="${solution.id}"><div class="my-solution-head"><span>Lời giải của bạn · ${escapeHTML(solutionStatusLabel(solution.status))}</span><span>${escapeHTML(formatDate(solution.created_at))}</span></div><p>${escapeHTML(solution.content)}</p>${solution.status !== 'verified' ? '<button type="button" data-delete-solution>Rút lời giải</button>' : ''}</article>`).join('');
}

function setReply(comment) {
  replyTo = comment;
  $('#replying-to strong').textContent = comment.author_name;
  $('#replying-to').hidden = false;
  $('#comment-content').focus();
}
function clearReply() { replyTo = null; $('#replying-to').hidden = true; }
$('#cancel-reply').addEventListener('click', clearReply);

$('#comments-list').addEventListener('click', async (event) => {
  const article = event.target.closest('[data-comment-id]');
  if (!article) return;
  const comment = comments.find((item) => Number(item.id) === Number(article.dataset.commentId));
  if (event.target.closest('[data-reply]')) setReply(comment);
  if (event.target.closest('[data-delete]')) {
    if (!confirm('Xóa bình luận này?')) return;
    try { await api(`/api/problems/comments/${comment.id}`, { method: 'DELETE' }); comments = comments.filter((item) => Number(item.id) !== Number(comment.id)); renderComments(); notify('Đã xóa bình luận.'); } catch (error) { notify(error.message); }
  }
});

$('#comment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const textarea = $('#comment-content');
  try {
    const result = await api(`/api/problems/${problemId}/comments`, { method: 'POST', body: JSON.stringify({ content: textarea.value, parentId: replyTo?.id || null }) });
    comments.push(result.comment); textarea.value = ''; clearReply(); renderComments(); notify('Đã đăng bình luận.');
  } catch (error) { notify(error.message); }
});

$('#detail-solution-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const textarea = $('#solution-content');
  try {
    const result = await api(`/api/problems/${problemId}/solutions`, { method: 'POST', body: JSON.stringify({ content: textarea.value }) });
    mySolutions.unshift(result.solution);
    textarea.value = '';
    renderMySolutions();
    notify('Đã gửi lời giải và chuyển tới tòa soạn duyệt.');
  } catch (error) { notify(error.message); }
});

$('#my-solutions').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-solution]');
  if (!button) return;
  const article = button.closest('[data-solution-id]');
  if (!confirm('Rút lời giải này khỏi hệ thống?')) return;
  try {
    await api(`/api/problems/solutions/${article.dataset.solutionId}`, { method: 'DELETE' });
    mySolutions = mySolutions.filter((solution) => Number(solution.id) !== Number(article.dataset.solutionId));
    renderMySolutions();
    notify('Đã rút lời giải.');
  } catch (error) { notify(error.message); }
});

async function start() {
  $('#problem-date').textContent = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date());
  $('#login-return-link').href = `/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`;
  $('#solution-login-link').href = `/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`;
  if (!Number.isSafeInteger(problemId) || problemId < 1) { $('#problem-loading').classList.add('error'); $('#problem-loading h1').textContent = 'Đường dẫn bài toán không hợp lệ.'; return; }
  try {
    const session = await api('/api/auth/me').catch(() => null);
    currentUser = session?.user || null;
    $('#detail-user').textContent = currentUser ? currentUser.name : 'Khách';
    $('#comment-form').hidden = !currentUser;
    $('#login-to-comment').hidden = Boolean(currentUser);
    $('#detail-solution-form').hidden = !currentUser;
    $('#solution-login-message').hidden = Boolean(currentUser);
    const [problemResult, solutionsResult, commentsResult, mySolutionsResult, bookmarksResult] = await Promise.all([
      api(`/api/problems/detail/${problemId}`),
      api(`/api/problems/${problemId}/solutions`),
      api(`/api/problems/${problemId}/comments`),
      currentUser ? api(`/api/problems/${problemId}/solutions/mine`) : Promise.resolve({ solutions: [] }),
      currentUser ? api('/api/bookmarks') : Promise.resolve({ bookmarks: [] }),
    ]);
    comments = commentsResult.comments;
    verifiedSolutions = solutionsResult.solutions;
    mySolutions = mySolutionsResult.solutions;
    isBookmarked = bookmarksResult.bookmarks.some((item) => Number(item.id) === problemId);
    renderProblem(problemResult.problem);
    renderBookmark();
    renderVerifiedSolutions();
    renderMySolutions();
    renderComments();
  } catch (error) {
    $('#problem-loading').classList.add('error');
    $('#problem-loading h1').textContent = error.message;
  }
}
start();

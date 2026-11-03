const $ = (selector, root = document) => root.querySelector(selector);
const problemId = Number(new URLSearchParams(location.search).get('id'));
const toast = $('#problem-toast');
let currentUser = null;
let comments = [];
let verifiedSolutions = [];
let mySolutions = [];
let replyTo = null;
let isBookmarked = false;
let isFollowed = false;
let problemLiked = false;
let problemReactionCount = 0;
let followerCount = 0;
let likedSolutionIds = new Set();
let solutionReactionCounts = new Map();
let commentPage = 1;
let commentHasMore = false;
let editingCommentId = null;
let editingSolutionId = null;
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
function roleLabel(role) { return { admin: 'Admin', moderator: 'Điều hành viên', editor: 'Biên tập viên', reader: 'Thành viên' }[role] || 'Thành viên'; }
function normalizeComment(comment) {
  return {
    id: comment.id,
    problem_id: comment.problemId,
    user_id: comment.author.id,
    parent_id: comment.parentId,
    content: comment.content,
    author_name: comment.author.name,
    author_role: comment.author.role,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    deleted: comment.deleted,
    edited: comment.edited,
  };
}
function normalizeSolution(solution) {
  return {
    id: solution.id,
    problem_id: solution.problemId,
    content: solution.content,
    status: solution.status,
    created_at: solution.createdAt,
    updated_at: solution.updatedAt,
    edited: solution.edited,
    is_featured: solution.isFeatured,
    review_note: solution.reviewNote,
    author_id: solution.author?.id,
    author_name: solution.author?.name,
    author_role: solution.author?.role,
  };
}

function renderProblem(problem) {
  document.title = `${problem.title} — Tờ Toán`;
  $('#problem-title').textContent = problem.title;
  $('#problem-statement').textContent = problem.body;
  $('#problem-byline').textContent = `Bài của ${problem.author.name} · Xuất bản ${formatDate(problem.publishedAt)}`;
  $('#problem-meta').innerHTML = `<span>${escapeHTML(problem.categories.map((category) => category.name).join(', ') || 'Chưa phân loại')}</span><span>${escapeHTML(problem.difficulty)}</span>`;
  const source = safeURL(problem.source);
  if (source) { $('#problem-source').href = source; $('#problem-source').hidden = false; }
  $('#problem-loading').hidden = true;
  $('#problem-page').hidden = false;
}

function renderBookmark() {
  $('#detail-bookmark').textContent = isBookmarked ? '★ Đã lưu bài toán' : '☆ Lưu bài toán';
  $('#detail-bookmark').setAttribute('aria-pressed', String(isBookmarked));
}
function renderEngagement() {
  renderBookmark();
  $('#detail-like').textContent = `${problemLiked ? '♥ Đã thích' : '♡ Thích'} · ${problemReactionCount}`;
  $('#detail-like').setAttribute('aria-pressed', String(problemLiked));
  $('#detail-follow').textContent = `${isFollowed ? '✓ Đang theo dõi' : '＋ Theo dõi'} · ${followerCount}`;
  $('#detail-follow').setAttribute('aria-pressed', String(isFollowed));
}
$('#detail-bookmark').addEventListener('click', async () => {
  if (!currentUser) { location.assign(`/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`); return; }
  const button = $('#detail-bookmark');
  button.disabled = true;
  try {
    await api(`/api/v1/bookmarks/${problemId}`, { method: isBookmarked ? 'DELETE' : 'PUT' });
    isBookmarked = !isBookmarked;
    renderBookmark();
    notify(isBookmarked ? 'Đã lưu bài toán vào hồ sơ.' : 'Đã bỏ lưu bài toán.');
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
});

$('#detail-like').addEventListener('click', async () => {
  if (!currentUser) { location.assign(`/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`); return; }
  const button = $('#detail-like');
  button.disabled = true;
  try {
    const result = await api(`/api/v1/problems/${problemId}/reaction`, { method: problemLiked ? 'DELETE' : 'PUT' });
    problemLiked = result.liked;
    problemReactionCount = result.reactionCount;
    renderEngagement();
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
});

$('#detail-follow').addEventListener('click', async () => {
  if (!currentUser) { location.assign(`/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`); return; }
  const button = $('#detail-follow');
  button.disabled = true;
  try {
    const result = await api(`/api/v1/follows/problems/${problemId}`, { method: isFollowed ? 'DELETE' : 'PUT' });
    isFollowed = result.followed;
    followerCount = result.followerCount;
    renderEngagement();
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
    const ownsComment = currentUser && Number(currentUser.id) === Number(comment.user_id);
    const canDelete = !comment.deleted && currentUser && (ownsComment || ['moderator', 'admin'].includes(currentUser.role));
    const edited = comment.edited && !comment.deleted ? '<span class="comment-time">Đã chỉnh sửa</span>' : '';
    const isEditing = String(editingCommentId) === String(comment.id);
    const content = isEditing
      ? `<div class="comment-inline-editor"><label for="comment-edit-${comment.id}">Chỉnh sửa bình luận</label><textarea id="comment-edit-${comment.id}" rows="5" minlength="2" maxlength="2000">${escapeHTML(comment.content)}</textarea><small>Từ 2 đến 2.000 ký tự.</small><div><button class="ink-button" type="button" data-save-comment>Lưu</button><button type="button" data-cancel-comment>Hủy</button></div></div>`
      : `<p class="comment-content">${escapeHTML(comment.content)}</p>`;
    const actions = isEditing ? '' : `<div class="comment-actions">${currentUser && !comment.deleted ? `<button type="button" data-reply>Trả lời</button>` : ''}${ownsComment && !comment.deleted ? '<button type="button" data-edit>Sửa</button>' : ''}${currentUser && !ownsComment && !comment.deleted ? '<button type="button" data-report>Báo cáo</button>' : ''}${canDelete ? '<button type="button" class="delete-comment" data-delete>Xóa</button>' : ''}</div>`;
    return `<article class="comment${isReply ? ' reply' : ''}" data-comment-id="${comment.id}"><div class="comment-avatar">${escapeHTML(comment.author_name.slice(0, 1))}</div><div><div class="comment-head"><strong>${escapeHTML(comment.author_name)}</strong><span class="comment-role">${escapeHTML(roleLabel(comment.author_role))}</span><span class="comment-time">${escapeHTML(formatDate(comment.created_at))}</span>${edited}</div>${content}${actions}</div></article>`;
  };
  list.innerHTML = roots.map((root) => renderOne(root) + (replies.get(Number(root.id)) || []).map((reply) => renderOne(reply, true)).join('')).join('') + (commentHasMore ? '<button class="outline-button" type="button" data-load-comments>Xem thêm bình luận</button>' : '');
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
  list.innerHTML = verifiedSolutions.map((solution, index) => {
    const liked = likedSolutionIds.has(String(solution.id));
    const count = solutionReactionCounts.get(String(solution.id)) || 0;
    return `<article class="verified-solution" data-public-solution-id="${solution.id}"><span class="verified-solution-meta">${solution.is_featured ? '★ Nổi bật · ' : ''}Lời giải ${String(index + 1).padStart(2, '0')} · ${escapeHTML(solution.author_name)} · ${escapeHTML(formatDate(solution.created_at))}${solution.edited ? ' · Đã chỉnh sửa' : ''}</span><h3>Một cách tiếp cận từ cộng đồng</h3><div class="verified-solution-content">${escapeHTML(solution.content)}</div><button class="solution-reaction" type="button" data-like-solution aria-pressed="${liked}">${liked ? '♥ Đã thích' : '♡ Thích'} · ${count}</button></article>`;
  }).join('');
}

$('#verified-solutions').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-like-solution]');
  if (!button) return;
  if (!currentUser) { location.assign(`/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`); return; }
  const article = button.closest('[data-public-solution-id]');
  const solutionId = String(article.dataset.publicSolutionId);
  const liked = likedSolutionIds.has(solutionId);
  button.disabled = true;
  try {
    const result = await api(`/api/v1/solutions/${solutionId}/reaction`, { method: liked ? 'DELETE' : 'PUT' });
    if (result.liked) likedSolutionIds.add(solutionId); else likedSolutionIds.delete(solutionId);
    solutionReactionCounts.set(solutionId, result.reactionCount);
    renderVerifiedSolutions();
  } catch (error) { button.disabled = false; notify(error.message); }
});

function renderMySolutions() {
  const container = $('#my-solutions');
  $('#detail-solution-form').hidden = !currentUser || mySolutions.some((solution) => solution.status === 'pending');
  if (!currentUser || !mySolutions.length) { container.innerHTML = ''; return; }
  container.innerHTML = mySolutions.map((solution) => {
    const isEditing = String(editingSolutionId) === String(solution.id);
    const content = isEditing
      ? `<div class="solution-inline-editor"><label for="solution-edit-${solution.id}">Chỉnh sửa lời giải</label><textarea id="solution-edit-${solution.id}" rows="10" minlength="20" maxlength="10000">${escapeHTML(solution.content)}</textarea><small>Tối thiểu 20 ký tự. Lời giải sau khi sửa sẽ được gửi duyệt lại.</small><div><button class="ink-button" type="button" data-save-solution>Lưu chỉnh sửa</button><button type="button" data-cancel-solution>Hủy</button></div></div>`
      : `<p>${escapeHTML(solution.content)}</p>`;
    const actions = isEditing
      ? ''
      : '<div class="comment-actions"><button type="button" data-edit-solution>Sửa</button><button type="button" data-solution-history>Lịch sử</button><button type="button" data-delete-solution>Rút lời giải</button></div>';
    return `<article class="my-solution" data-solution-id="${solution.id}"><div class="my-solution-head"><span>Lời giải của bạn · ${escapeHTML(solutionStatusLabel(solution.status))}</span><span>${escapeHTML(formatDate(solution.created_at))}</span></div>${content}${solution.review_note ? `<small>Lý do kiểm duyệt: ${escapeHTML(solution.review_note)}</small>` : ''}${actions}</article>`;
  }).join('');
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
  if (event.target.closest('[data-load-comments]')) {
    const button = event.target.closest('[data-load-comments]');
    button.disabled = true;
    try {
      const result = await api(`/api/v1/problems/${problemId}/comments?page=${commentPage + 1}&limit=100`);
      commentPage += 1;
      commentHasMore = result.hasMore;
      comments.push(...result.comments.map(normalizeComment));
      renderComments();
    } catch (error) { notify(error.message); button.disabled = false; }
    return;
  }
  const article = event.target.closest('[data-comment-id]');
  if (!article) return;
  const comment = comments.find((item) => Number(item.id) === Number(article.dataset.commentId));
  if (!comment) return;
  if (event.target.closest('[data-reply]')) setReply(comment);
  if (event.target.closest('[data-edit]')) {
    editingCommentId = comment.id;
    renderComments();
    $(`#comment-edit-${comment.id}`)?.focus();
    return;
  }
  if (event.target.closest('[data-cancel-comment]')) {
    editingCommentId = null;
    renderComments();
    return;
  }
  if (event.target.closest('[data-save-comment]')) {
    const content = $(`#comment-edit-${comment.id}`)?.value.trim() || '';
    if (content.length < 2) { notify('Bình luận cần có ít nhất 2 ký tự.'); return; }
    if (content === comment.content.trim()) { notify('Nội dung bình luận chưa thay đổi.'); return; }
    const button = event.target.closest('[data-save-comment]');
    button.disabled = true;
    try {
      const result = await api(`/api/v1/comments/${comment.id}`, { method: 'PATCH', body: JSON.stringify({ content }) });
      Object.assign(comment, normalizeComment(result.comment));
      editingCommentId = null;
      renderComments();
      notify('Đã sửa bình luận.');
    } catch (error) { button.disabled = false; notify(error.message); }
    return;
  }
  if (event.target.closest('[data-report]')) {
    const reason = prompt('Lý do báo cáo: spam, harassment, inappropriate, misinformation hoặc other', 'inappropriate');
    if (!reason) return;
    try {
      const result = await api(`/api/v1/comments/${comment.id}/reports`, { method: 'POST', body: JSON.stringify({ reason }) });
      notify(result.message);
    } catch (error) { notify(error.message); }
  }
  if (event.target.closest('[data-delete]')) {
    if (!confirm('Xóa bình luận này?')) return;
    try { await api(`/api/v1/comments/${comment.id}`, { method: 'DELETE' }); comment.deleted = true; comment.content = '[Bình luận đã được xóa]'; renderComments(); notify('Đã xóa bình luận.'); } catch (error) { notify(error.message); }
  }
});

$('#comment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const textarea = $('#comment-content');
  try {
    const result = await api(`/api/v1/problems/${problemId}/comments`, { method: 'POST', body: JSON.stringify({ content: textarea.value, parentId: replyTo?.id ? String(replyTo.id) : undefined }) });
    comments.push(normalizeComment(result.comment)); textarea.value = ''; clearReply(); renderComments(); notify('Đã đăng bình luận.');
  } catch (error) { notify(error.message); }
});

$('#detail-solution-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const textarea = $('#solution-content');
  try {
    const result = await api(`/api/v1/problems/${problemId}/solutions`, { method: 'POST', body: JSON.stringify({ content: textarea.value }) });
    mySolutions.unshift(normalizeSolution(result.solution));
    textarea.value = '';
    renderMySolutions();
    notify('Đã gửi lời giải và chuyển tới tòa soạn duyệt.');
  } catch (error) { notify(error.message); }
});

$('#my-solutions').addEventListener('click', async (event) => {
  const article = event.target.closest('[data-solution-id]');
  if (!article) return;
  const solution = mySolutions.find((item) => Number(item.id) === Number(article.dataset.solutionId));
  if (!solution) return;
  if (event.target.closest('[data-edit-solution]')) {
    editingSolutionId = solution.id;
    renderMySolutions();
    $(`#solution-edit-${solution.id}`)?.focus();
    return;
  }
  if (event.target.closest('[data-cancel-solution]')) {
    editingSolutionId = null;
    renderMySolutions();
    return;
  }
  if (event.target.closest('[data-save-solution]')) {
    const content = $(`#solution-edit-${solution.id}`)?.value.trim() || '';
    if (content.length < 20) { notify('Lời giải cần có ít nhất 20 ký tự.'); return; }
    if (content === solution.content.trim()) { notify('Nội dung lời giải chưa thay đổi.'); return; }
    const button = event.target.closest('[data-save-solution]');
    button.disabled = true;
    try {
      const result = await api(`/api/v1/solutions/${solution.id}`, { method: 'PATCH', body: JSON.stringify({ content, changeSummary: 'Chỉnh sửa từ trang bài toán' }) });
      Object.assign(solution, normalizeSolution(result.solution));
      verifiedSolutions = verifiedSolutions.filter((item) => Number(item.id) !== Number(solution.id));
      editingSolutionId = null;
      renderMySolutions();
      renderVerifiedSolutions();
      notify('Đã sửa lời giải và gửi duyệt lại.');
    } catch (error) { button.disabled = false; notify(error.message); }
    return;
  }
  if (event.target.closest('[data-solution-history]')) {
    try {
      const result = await api(`/api/v1/solutions/${solution.id}/history`);
      alert(result.revisions.map((revision) => `Phiên bản ${revision.version}: ${revision.changeSummary || revision.status}`).join('\n'));
    } catch (error) { notify(error.message); }
  }
  if (event.target.closest('[data-delete-solution]')) {
    if (!confirm('Rút lời giải này khỏi hệ thống?')) return;
    try {
      await api(`/api/v1/solutions/${solution.id}`, { method: 'DELETE' });
      mySolutions = mySolutions.filter((item) => Number(item.id) !== Number(solution.id));
      renderMySolutions();
      notify('Đã rút lời giải.');
    } catch (error) { notify(error.message); }
  }
});

async function start() {
  $('#problem-date').textContent = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date());
  $('#login-return-link').href = `/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`;
  $('#solution-login-link').href = `/?login=1&return=${encodeURIComponent(location.pathname + location.search)}`;
  if (!Number.isSafeInteger(problemId) || problemId < 1) { $('#problem-loading').classList.add('error'); $('#problem-loading h1').textContent = 'Đường dẫn bài toán không hợp lệ.'; return; }
  try {
    const session = await api('/api/v1/auth/me').catch(() => null);
    currentUser = session?.user || null;
    $('#detail-user').textContent = currentUser ? currentUser.name : 'Khách';
    $('#comment-form').hidden = !currentUser;
    $('#login-to-comment').hidden = Boolean(currentUser);
    $('#detail-solution-form').hidden = !currentUser;
    $('#solution-login-message').hidden = Boolean(currentUser);
    const [problemResult, solutionsResult, commentsResult, mySolutionsResult, engagementResult, myEngagementResult] = await Promise.all([
      api(`/api/v1/problems/${problemId}`),
      api(`/api/v1/problems/${problemId}/solutions?limit=100`),
      api(`/api/v1/problems/${problemId}/comments?page=1&limit=100`),
      currentUser ? api(`/api/v1/problems/${problemId}/solutions/mine`) : Promise.resolve({ solutions: [] }),
      api(`/api/v1/problems/${problemId}/engagement`),
      currentUser ? api(`/api/v1/problems/${problemId}/engagement/mine`) : Promise.resolve({ bookmarked: false, followed: false, problemLiked: false, likedSolutionIds: [] }),
    ]);
    comments = commentsResult.comments.map(normalizeComment);
    commentPage = commentsResult.page;
    commentHasMore = commentsResult.hasMore;
    verifiedSolutions = solutionsResult.solutions.map(normalizeSolution);
    mySolutions = mySolutionsResult.solutions.map(normalizeSolution);
    isBookmarked = myEngagementResult.bookmarked;
    isFollowed = myEngagementResult.followed;
    problemLiked = myEngagementResult.problemLiked;
    problemReactionCount = engagementResult.reactionCount;
    followerCount = engagementResult.followerCount;
    likedSolutionIds = new Set(myEngagementResult.likedSolutionIds.map(String));
    solutionReactionCounts = new Map(Object.entries(engagementResult.solutionReactions || {}).map(([id, count]) => [String(id), Number(count)]));
    renderProblem(problemResult.problem);
    renderEngagement();
    renderVerifiedSolutions();
    renderMySolutions();
    renderComments();
  } catch (error) {
    $('#problem-loading').classList.add('error');
    $('#problem-loading h1').textContent = error.message;
  }
}
start();

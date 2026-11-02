const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const gate = $('#admin-gate');
const app = $('#admin-app');
const toast = $('#admin-toast');
let currentUser = null;
let toastTimer;

function escapeHTML(value) {
  const element = document.createElement('div');
  element.textContent = value ?? '';
  return element.innerHTML;
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHTML(url.href) : '';
  } catch {
    return '';
  }
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || 'Không thể kết nối tới máy chủ.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function showDenied(message) {
  gate.classList.add('denied');
  gate.querySelector('.eyebrow').textContent = 'Không thể mở bàn biên tập';
  gate.querySelector('h1').textContent = 'Bạn chưa có quyền quản trị.';
  $('#admin-gate-message').textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderStats(stats) {
  $('#stat-pending').textContent = stats.pendingProblems;
  $('#stat-published').textContent = stats.publishedProblems;
  $('#stat-users').textContent = stats.users;
  $('#stat-solutions').textContent = stats.pendingSolutions;
}

function statusLabel(status) {
  return { pending: 'Chờ duyệt', published: 'Đã xuất bản', verified: 'Đã kiểm chứng', rejected: 'Đã từ chối', draft: 'Bản nháp' }[status] || status;
}

function renderProblems(problems) {
  const list = $('#moderation-list');
  if (!problems.length) {
    list.innerHTML = '<p class="admin-empty">Không có bài toán nào trong nhóm trạng thái này.</p>';
    return;
  }
  list.innerHTML = problems.map((problem, index) => {
    const actions = problem.status === 'pending'
      ? `<button class="ink-button" data-problem-action="published" data-id="${problem.id}">Duyệt &amp; xuất bản</button><button class="outline-button reject-button" data-problem-action="rejected" data-id="${problem.id}">Từ chối</button>`
      : `<button class="outline-button restore-button" data-problem-action="pending" data-id="${problem.id}">Đưa về chờ duyệt</button>${problem.status !== 'published' ? `<button class="ink-button" data-problem-action="published" data-id="${problem.id}">Xuất bản</button>` : `<button class="outline-button reject-button" data-problem-action="rejected" data-id="${problem.id}">Gỡ bài</button>`}`;
    return `<article class="moderation-card">
      <div class="moderation-number">${String(index + 1).padStart(2, '0')}</div>
      <div class="moderation-copy">
        <div class="moderation-meta"><span class="status-chip status-${escapeHTML(problem.status)}">${escapeHTML(statusLabel(problem.status))}</span><span>${escapeHTML(problem.categories || 'Chưa phân loại')}</span><span>${escapeHTML(problem.difficulty)}</span><span>${escapeHTML(formatDate(problem.created_at))}</span></div>
        <h3>${escapeHTML(problem.title)}</h3>
        <p>${escapeHTML(problem.content)}</p>
        <p class="moderation-author">Gửi bởi <strong>${escapeHTML(problem.author_name)}</strong> · ${escapeHTML(problem.author_email)}</p>
        ${safeURL(problem.source) ? `<a class="moderation-source" href="${safeURL(problem.source)}" target="_blank" rel="noopener">Mở nguồn tham khảo ↗</a>` : ''}
      </div>
      <div class="moderation-actions">${actions}</div>
    </article>`;
  }).join('');
}

function roleOptions(selected) {
  return [['reader', 'Độc giả'], ['editor', 'Biên tập viên'], ['admin', 'Admin']]
    .map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`).join('');
}

function statusOptions(selected) {
  return [['active', 'Hoạt động'], ['disabled', 'Vô hiệu hóa']]
    .map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`).join('');
}

function renderUsers(users) {
  $('#users-table-body').innerHTML = users.map((user) => {
    const isCurrent = Number(user.id) === Number(currentUser.id);
    return `<tr data-user-id="${user.id}"${isCurrent ? ' class="current-user"' : ''}>
      <td><strong>${escapeHTML(user.name)}${isCurrent ? ' (bạn)' : ''}</strong><small>${escapeHTML(user.email)}</small></td>
      <td>${Number(user.problem_count)} bài · ${Number(user.solution_count)} lời giải</td>
      <td><select data-user-role aria-label="Vai trò của ${escapeHTML(user.name)}">${roleOptions(user.role)}</select></td>
      <td><select data-user-status aria-label="Trạng thái của ${escapeHTML(user.name)}">${statusOptions(user.status)}</select></td>
      <td><button class="ink-button" data-save-user${isCurrent ? ' disabled' : ''}>Lưu</button></td>
    </tr>`;
  }).join('');
}

function renderSolutions(solutions) {
  const list = $('#solution-review-list');
  if (!solutions.length) {
    list.innerHTML = '<p class="admin-empty">Không có lời giải nào trong nhóm trạng thái này.</p>';
    return;
  }
  list.innerHTML = solutions.map((solution) => {
    const actions = solution.status === 'pending'
      ? `<button class="ink-button" data-solution-action="verified" data-id="${solution.id}">Kiểm chứng &amp; công khai</button><button class="outline-button reject-button" data-solution-action="rejected" data-id="${solution.id}">Từ chối</button>`
      : `<button class="outline-button restore-button" data-solution-action="pending" data-id="${solution.id}">Đưa về chờ duyệt</button>${solution.status !== 'verified' ? `<button class="ink-button" data-solution-action="verified" data-id="${solution.id}">Công khai</button>` : `<button class="outline-button reject-button" data-solution-action="rejected" data-id="${solution.id}">Gỡ lời giải</button>`}`;
    return `<article class="solution-review-card"><div><div class="moderation-meta"><span class="status-chip status-${escapeHTML(solution.status)}">${escapeHTML(statusLabel(solution.status))}</span><span>${escapeHTML(formatDate(solution.created_at))}</span></div><h3>${escapeHTML(solution.problem_title)}</h3><p class="solution-review-author">Lời giải của <strong>${escapeHTML(solution.author_name)}</strong> · ${escapeHTML(solution.author_email)}</p><div class="solution-review-content">${escapeHTML(solution.content)}</div></div><div class="solution-review-actions">${actions}</div></article>`;
  }).join('');
}

async function loadStats() {
  const result = await api('/api/admin/stats');
  renderStats(result.stats);
}

async function loadProblems() {
  const status = $('#problem-status-filter').value;
  const result = await api(`/api/admin/problems?status=${encodeURIComponent(status)}`);
  renderProblems(result.problems);
}

async function loadUsers() {
  const result = await api('/api/admin/users');
  renderUsers(result.users);
}

async function loadSolutions() {
  const status = $('#solution-status-filter').value;
  const result = await api(`/api/admin/solutions?status=${encodeURIComponent(status)}`);
  renderSolutions(result.solutions);
}

async function loadVideos() {
  const result = await api('/api/admin/videos');
  $('#admin-video-list').innerHTML = result.videos.length ? result.videos.map((video) => `<article class="admin-video-row"><div><span class="status-chip status-${escapeHTML(video.status)}">${video.status === 'published' ? 'Công khai' : 'Đã gỡ'}</span><strong>${escapeHTML(video.title)}</strong><small>${escapeHTML(video.topic)} · ${escapeHTML(video.duration)} · ${escapeHTML(video.author_name)}</small></div>${video.status === 'published' ? `<button type="button" class="outline-button reject-button" data-remove-video="${Number(video.id)}">Gỡ video</button>` : ''}</article>`).join('') : '<p class="admin-empty">Chưa có video nào.</p>';
}

async function loadComments() {
  const result = await api('/api/admin/comments');
  $('#admin-comments-list').innerHTML = result.comments.length ? result.comments.map((comment) => `<article class="admin-comment-row"><div><small>${escapeHTML(comment.author_name)} · ${escapeHTML(formatDate(comment.created_at))} · <a href="/problem.html?id=${Number(comment.problem_id)}#thao-luan">${escapeHTML(comment.problem_title)}</a></small><p>${escapeHTML(comment.content)}</p></div><button class="outline-button reject-button" type="button" data-hide-comment="${Number(comment.id)}">Ẩn bình luận</button></article>`).join('') : '<p class="admin-empty">Chưa có bình luận nào.</p>';
}
$('#admin-comments-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-hide-comment]');
  if (!button || !confirm('Ẩn bình luận này khỏi bài toán?')) return;
  button.disabled = true;
  try { await api(`/api/admin/comments/${button.dataset.hideComment}`, { method: 'DELETE' }); await loadComments(); notify('Đã ẩn bình luận.'); }
  catch (error) { button.disabled = false; notify(error.message); }
});

$('#admin-video-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await api('/api/admin/videos', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    await loadVideos();
    notify('Đã thêm video vào thư viện.');
  } catch (error) { notify(error.message); }
  finally { submit.disabled = false; }
});
$('#admin-video-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-remove-video]');
  if (!button || !confirm('Gỡ video này khỏi thư viện công khai?')) return;
  button.disabled = true;
  try { await api(`/api/admin/videos/${button.dataset.removeVideo}`, { method: 'DELETE' }); await loadVideos(); notify('Đã gỡ video.'); }
  catch (error) { button.disabled = false; notify(error.message); }
});

$('#problem-status-filter').addEventListener('change', () => loadProblems().catch((error) => notify(error.message)));
$('#solution-status-filter').addEventListener('change', () => loadSolutions().catch((error) => notify(error.message)));

$('#moderation-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-problem-action]');
  if (!button) return;
  const nextStatus = button.dataset.problemAction;
  const label = statusLabel(nextStatus).toLowerCase();
  if (!confirm(`Xác nhận chuyển bài toán sang trạng thái “${label}”?`)) return;
  button.disabled = true;
  try {
    await api(`/api/admin/problems/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
    notify(`Đã cập nhật bài toán: ${statusLabel(nextStatus)}.`);
    await Promise.all([loadStats(), loadProblems()]);
  } catch (error) {
    button.disabled = false;
    notify(error.message);
  }
});

$('#users-table-body').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-save-user]');
  if (!button) return;
  const row = button.closest('[data-user-id]');
  button.disabled = true;
  try {
    await api(`/api/admin/users/${row.dataset.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: $('[data-user-role]', row).value, status: $('[data-user-status]', row).value }),
    });
    notify('Đã cập nhật tài khoản.');
    await loadUsers();
  } catch (error) {
    button.disabled = false;
    notify(error.message);
  }
});

$('#solution-review-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-solution-action]');
  if (!button) return;
  const nextStatus = button.dataset.solutionAction;
  if (!confirm(`Xác nhận chuyển lời giải sang trạng thái “${statusLabel(nextStatus).toLowerCase()}”?`)) return;
  button.disabled = true;
  try {
    await api(`/api/admin/solutions/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
    notify(`Đã cập nhật lời giải: ${statusLabel(nextStatus)}.`);
    await Promise.all([loadStats(), loadSolutions()]);
  } catch (error) {
    button.disabled = false;
    notify(error.message);
  }
});

$('#admin-logout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
  window.location.href = '/';
});

async function startAdmin() {
  $('#admin-date').textContent = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date());
  try {
    const session = await api('/api/auth/me');
    currentUser = session.user;
    if (currentUser.role !== 'admin') {
      showDenied('Tài khoản hiện tại là độc giả. Hãy cấp quyền admin rồi tải lại trang.');
      return;
    }
    $('#admin-name').textContent = currentUser.name.split(' ').pop();
    gate.hidden = true;
    app.hidden = false;
    await Promise.all([loadStats(), loadProblems(), loadSolutions(), loadComments(), loadVideos(), loadUsers()]);
  } catch (error) {
    showDenied(error.status === 401 ? 'Bạn cần đăng nhập bằng tài khoản admin ở trang chính.' : error.message);
  }
}

startAdmin();

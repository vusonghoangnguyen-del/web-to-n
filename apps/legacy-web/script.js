const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toast = $('#toast');
const AUTH_API = '/api/v1/auth';
const loginDialog = $('#login-dialog');
const publishDialog = $('#publish-dialog');
let user = null;
let bookmarks = new Set();
let page = 1;
let filter = 'all';
let searchTimer;
let requestSerial = 0;
let toastTimer;
let accountNotifications = [];

function escapeHTML(value) {
  const el = document.createElement('div');
  el.textContent = value ?? '';
  return el.innerHTML;
}
function safeURL(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || 'Không thể kết nối tới máy chủ.');
  return data;
}
function openDialog(dialog) { dialog.showModal(); }
$$('.modal-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

function setAuthMode(mode) {
  const register = mode === 'register';
  const form = $('#login-form');
  form.dataset.mode = mode;
  $('#auth-name-field').hidden = !register;
  form.elements.username.required = register;
  $$('.register-only', form).forEach((element) => { element.hidden = !register; });
  form.elements.passwordConfirmation.required = register;
  form.elements.acceptTerms.required = register;
  form.elements.password.minLength = register ? 8 : 1;
  form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-title').textContent = register ? 'Tạo tài khoản Tờ Toán' : 'Đăng nhập Tờ Toán';
  $('#auth-description').textContent = register ? 'Tạo hồ sơ để đăng bài, gửi lời giải và lưu bài toán.' : 'Tiếp tục hành trình tìm một cách giải mới.';
  $('#auth-submit').textContent = register ? 'Tạo tài khoản' : 'Đăng nhập';
  $$('[data-auth-mode]').forEach((button) => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}
$$('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
function showLogin() { setAuthMode('login'); openDialog(loginDialog); }
function requireUser(next) { if (user) next(); else { showLogin(); notify('Đăng nhập để tiếp tục.'); } }

const accountMenu = $('#account-menu');
const accountTrigger = $('#login-open');
function closeAccountMenu() {
  accountMenu.hidden = true;
  accountTrigger.setAttribute('aria-expanded', 'false');
  $('#account-notifications').hidden = true;
  $('#account-notifications-toggle').setAttribute('aria-expanded', 'false');
}
function toggleAccountMenu() {
  const shouldOpen = accountMenu.hidden;
  accountMenu.hidden = !shouldOpen;
  accountTrigger.setAttribute('aria-expanded', String(shouldOpen));
}
function renderAccountNotifications() {
  const list = $('#account-notifications');
  const count = $('#account-notification-count');
  count.textContent = String(accountNotifications.length);
  count.hidden = accountNotifications.length === 0;
  $('#account-notification-summary').textContent = accountNotifications.length
    ? `${accountNotifications.length} cập nhật về nội dung của bạn`
    : 'Không có thông báo mới';
  list.innerHTML = accountNotifications.length
    ? accountNotifications.slice(0, 5).map((item) => `<a href="${item.href}" data-account-close><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.message)}</small></a>`).join('')
    : '<p>Hiện chưa có cập nhật nào.</p>';
}

function renderUser() {
  accountTrigger.textContent = user ? `${user.name.split(' ').pop()}  ▾` : 'Đăng nhập';
  accountTrigger.classList.toggle('signed-in', Boolean(user));
  accountTrigger.setAttribute('aria-haspopup', user ? 'menu' : 'false');
  $('#admin-open').hidden = !['moderator', 'admin'].includes(user?.role);
  $('#account-admin-link').hidden = !['moderator', 'admin'].includes(user?.role);
  accountMenu.hidden = true;
  accountTrigger.setAttribute('aria-expanded', 'false');
  $('#account-avatar').textContent = user?.name?.trim().charAt(0).toUpperCase() || 'T';
  $('#account-name').textContent = user?.name || 'Tài khoản';
  $('#account-email').textContent = user?.email || '';
  $('#profile-guest').hidden = Boolean(user);
  $('#profile-content').hidden = !user;
  $('#profile-name').textContent = user ? `${user.name} · ${user.email}` : '';
  updateBookmarkButtons();
}
accountTrigger.addEventListener('click', (event) => {
  event.stopPropagation();
  if (user) toggleAccountMenu(); else showLogin();
});
accountMenu.addEventListener('click', (event) => {
  event.stopPropagation();
  if (event.target.closest('[data-account-close]')) closeAccountMenu();
});
document.addEventListener('click', closeAccountMenu);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAccountMenu(); });
$$('[data-account-close]').forEach((element) => element.addEventListener('click', closeAccountMenu));
$('#account-notifications-toggle').addEventListener('click', () => {
  const panel = $('#account-notifications');
  panel.hidden = !panel.hidden;
  $('#account-notifications-toggle').setAttribute('aria-expanded', String(!panel.hidden));
});
$('#profile-login').addEventListener('click', showLogin);
async function logout() {
  try { await api(`${AUTH_API}/logout`, { method: 'POST' }); }
  catch (error) { notify(error.message); return; }
  user = null;
  bookmarks = new Set();
  accountNotifications = [];
  $('#my-problems').replaceChildren();
  $('#my-solutions-summary').replaceChildren();
  $('#my-bookmarks').replaceChildren();
  renderUser();
  notify('Bạn đã đăng xuất.');
}
$('#profile-logout').addEventListener('click', logout);
$('#account-logout').addEventListener('click', logout);
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const action = form.dataset.mode;
  const submit = $('#auth-submit');
  submit.disabled = true;
  try {
    const payload = action === 'register'
      ? {
          username: data.get('username'),
          email: data.get('email'),
          password: data.get('password'),
          passwordConfirmation: data.get('passwordConfirmation'),
          acceptTerms: data.get('acceptTerms') === 'on',
        }
      : { email: data.get('email'), password: data.get('password') };
    const result = await api(`${AUTH_API}/${action}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (action === 'register') {
      sessionStorage.setItem('pendingVerificationEmail', String(data.get('email')).trim().toLowerCase());
      sessionStorage.setItem('verificationEmailSentAt', String(Date.now()));
      loginDialog.close();
      form.reset();
      location.assign('/check-email.html');
      return;
    }
    user = result.user;
    loginDialog.close();
    form.reset();
    await loadProfile();
    renderUser();
    notify(`Chào ${user.name}!`);
    const target = new URLSearchParams(location.search).get('return');
    if (target?.startsWith('/') && !target.startsWith('//')) location.assign(target);
  } catch (error) { notify(error.message); }
  finally { submit.disabled = false; }
});

$('#publish-open').addEventListener('click', () => requireUser(() => openDialog(publishDialog)));
$('#publish-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await api('/api/problems', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    publishDialog.close();
    form.reset();
    await loadMyProblems();
    notify('Bài toán đã được gửi và đang chờ duyệt. Xem trạng thái ở Góc của bạn.');
  } catch (error) { notify(error.message); }
  finally { submit.disabled = false; }
});

const categoryName = { 'so-hoc': 'Số học', 'hinh-hoc': 'Hình học', 'dai-so': 'Đại số', 'to-hop': 'Tổ hợp', logic: 'Logic', 'xac-suat': 'Xác suất' };
function problemCard(item) {
  const id = Number(item.id);
  const saved = bookmarks.has(id);
  const tag = (item.tags || '').split(' ')[0];
  return `<article class="problem-card" data-problem-id="${id}"><div class="card-top"><span class="number">№ ${id}</span><button class="bookmark${saved ? ' saved' : ''}" type="button" data-bookmark="${id}" aria-label="${saved ? 'Bỏ lưu' : 'Lưu'} bài ${escapeHTML(item.title)}" aria-pressed="${saved}">${saved ? '★' : '☆'}</button></div><span class="rubric">${escapeHTML(categoryName[tag] || 'Bài toán cộng đồng')}</span><h3><a class="card-title-link" href="/problem.html?id=${id}">${escapeHTML(item.title)}</a></h3><p>${escapeHTML(item.body)}</p><div class="card-stats"><span class="difficulty medium">${escapeHTML(item.difficulty)}</span><span>${Number(item.comment_count || 0)} thảo luận</span></div><a class="text-button discussion-link" href="/problem.html?id=${id}">Đọc &amp; gửi lời giải <span>→</span></a></article>`;
}
function updateBookmarkButtons() {
  $$('[data-bookmark]').forEach((button) => {
    const saved = bookmarks.has(Number(button.dataset.bookmark));
    button.classList.toggle('saved', saved);
    button.textContent = saved ? '★' : '☆';
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? 'Bỏ lưu' : 'Lưu'} bài ${button.closest('.problem-card')?.querySelector('h3')?.textContent || ''}`);
  });
}
$('#problem-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-bookmark]');
  if (!button) return;
  requireUser(async () => {
    const id = Number(button.dataset.bookmark);
    button.disabled = true;
    try {
      const saved = bookmarks.has(id);
      await api(`/api/bookmarks/${id}`, { method: saved ? 'DELETE' : 'PUT' });
      if (saved) bookmarks.delete(id); else bookmarks.add(id);
      updateBookmarkButtons();
      await loadBookmarks();
      notify(saved ? 'Đã bỏ lưu bài toán.' : 'Đã lưu bài toán vào hồ sơ.');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  });
});

function renderLead(items) {
  const first = items[0];
  if (!first) { $('#recent-list').innerHTML = '<li><span>—</span><div>Chưa có bài toán nào được xuất bản.</div></li>'; return; }
  $('#lead-title').textContent = first.title;
  $('#lead-summary').textContent = first.body.length > 220 ? `${first.body.slice(0, 220)}…` : first.body;
  $('#lead-difficulty').textContent = first.difficulty;
  $('#lead-link').href = `/problem.html?id=${Number(first.id)}`;
  $('#lead-link').innerHTML = 'Đọc bài toán <span>→</span>';
  $('#lead-date').textContent = `Bài của ${first.author}`;
  $('#recent-list').innerHTML = items.slice(0, 5).map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><div><a href="/problem.html?id=${Number(item.id)}">${escapeHTML(item.title)}</a><small>${escapeHTML(item.difficulty)} · ${Number(item.comment_count || 0)} thảo luận</small></div></li>`).join('');
}
async function loadProblems(reset = true) {
  if (reset) page = 1;
  const serial = ++requestSerial;
  const query = new URLSearchParams({ page: String(page), category: filter, difficulty: $('#difficulty-filter').value, search: $('#problem-search').value.trim() });
  try {
    const result = await api(`/api/problems?${query}`);
    if (serial !== requestSerial) return;
    if (reset) $('#problem-grid').replaceChildren();
    $('#problem-grid').insertAdjacentHTML('beforeend', result.problems.map(problemCard).join(''));
    $('#empty-state').textContent = 'Chưa có bài phù hợp. Thử từ khóa hoặc chuyên mục khác nhé.';
    $('#empty-state').style.display = result.total ? 'none' : 'block';
    $('#load-more').hidden = !result.hasMore;
    if (reset && filter === 'all' && !$('#problem-search').value.trim() && !$('#difficulty-filter').value) renderLead(result.problems);
  } catch (error) {
    if (serial === requestSerial) {
      $('#empty-state').style.display = 'block';
      $('#empty-state').textContent = `Không tải được bài toán: ${error.message}`;
      $('#load-more').hidden = true;
    }
  }
}
$$('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
  loadProblems();
}));
$('#problem-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadProblems(), 250); });
$('#difficulty-filter').addEventListener('change', () => loadProblems());
$('#load-more').addEventListener('click', () => { page += 1; loadProblems(false); });

function profileRow(item, badge, href = null) {
  const title = escapeHTML(item.title);
  return `<article class="profile-row"><span class="status-chip status-${escapeHTML(item.status || 'published')}">${escapeHTML(badge)}</span><strong>${href ? `<a href="${href}">${title}</a>` : title}</strong></article>`;
}
async function loadMyProblems() {
  if (!user) return;
  try {
    const result = await api('/api/problems/mine');
    accountNotifications = accountNotifications.filter((item) => item.kind !== 'problem');
    accountNotifications.push(...result.problems.filter((item) => ['pending', 'rejected'].includes(item.status)).map((item) => ({
      kind: 'problem',
      title: item.title,
      message: item.status === 'pending' ? 'Bài toán đang chờ tòa soạn duyệt.' : 'Bài toán chưa được duyệt.',
      href: '#ho-so',
    })));
    renderAccountNotifications();
    $('#my-problems').innerHTML = result.problems.length ? result.problems.map((item) => profileRow(item, { pending: 'Chờ duyệt', rejected: 'Đã từ chối', published: 'Đã xuất bản' }[item.status] || item.status, item.status === 'published' ? `/problem.html?id=${Number(item.id)}` : null)).join('') : '<p class="home-muted">Bạn chưa gửi bài toán nào.</p>';
  } catch (error) { notify(error.message); }
}
async function loadBookmarks() {
  if (!user) return;
  try {
    const result = await api('/api/bookmarks');
    bookmarks = new Set(result.bookmarks.map((item) => Number(item.id)));
    $('#my-bookmarks').innerHTML = result.bookmarks.length ? result.bookmarks.map((item) => profileRow(item, item.difficulty, `/problem.html?id=${Number(item.id)}`)).join('') : '<p class="home-muted">Chưa có bài nào được lưu.</p>';
    updateBookmarkButtons();
  } catch (error) { notify(error.message); }
}
async function loadMySolutions() {
  if (!user) return;
  try {
    const result = await api('/api/problems/solutions/mine');
    accountNotifications = accountNotifications.filter((item) => item.kind !== 'solution');
    accountNotifications.push(...result.solutions.filter((item) => ['pending', 'rejected'].includes(item.status)).map((item) => ({
      kind: 'solution',
      title: item.problem_title,
      message: item.status === 'pending' ? 'Lời giải đang chờ kiểm chứng.' : 'Lời giải chưa được duyệt.',
      href: '#ho-so',
    })));
    renderAccountNotifications();
    const labels = { pending: 'Chờ duyệt', verified: 'Đã kiểm chứng', rejected: 'Đã từ chối' };
    $('#my-solutions-summary').innerHTML = result.solutions.length ? result.solutions.map((item) => profileRow({ title: item.problem_title, status: item.status }, labels[item.status] || item.status, item.problem_status === 'published' ? `/problem.html?id=${Number(item.problem_id)}#loi-giai` : null)).join('') : '<p class="home-muted">Bạn chưa gửi lời giải nào.</p>';
  } catch (error) { notify(error.message); }
}
async function loadProfile() { await Promise.all([loadMyProblems(), loadMySolutions(), loadBookmarks()]); }

async function loadFeaturedSolutions() {
  try {
    const result = await api('/api/featured-solutions');
    $('#featured-solutions').innerHTML = result.solutions.length ? result.solutions.map((item, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><div><h4><a href="/problem.html?id=${Number(item.problem_id)}#loi-giai">${escapeHTML(item.problem_title)}</a></h4><p>${escapeHTML(item.author_name)} · ${escapeHTML(item.excerpt)}…</p></div></article>`).join('') : '<p class="home-muted">Chưa có lời giải được kiểm chứng. Bạn có thể gửi lời giải trong một bài toán đã xuất bản.</p>';
  } catch (error) { $('#featured-solutions').innerHTML = `<p class="home-muted">${escapeHTML(error.message)}</p>`; }
}
async function loadVideos() {
  try {
    const result = await api('/api/videos');
    const videos = result.videos.filter((item) => safeURL(item.url));
    $('#video-grid').innerHTML = videos.map((item, index) => `<article class="video-card${index === 0 ? ' large' : ''}"><a class="video-thumb ${index % 3 === 0 ? 'thumb-one' : index % 3 === 1 ? 'thumb-two' : 'thumb-three'}" href="${escapeHTML(safeURL(item.url))}" target="_blank" rel="noopener noreferrer" aria-label="Xem video ${escapeHTML(item.title)}"><span>▶</span><i>${escapeHTML(item.duration)}</i></a><div><span class="rubric">${escapeHTML(item.topic)}</span><h3>${escapeHTML(item.title)}</h3></div></article>`).join('');
    $('#video-empty').hidden = videos.length > 0;
  } catch (error) { $('#video-empty').hidden = false; $('#video-empty').textContent = error.message; }
}
$('#newsletter-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/newsletter', { method: 'POST', body: JSON.stringify({ email: form.elements.email.value }) });
    $('#newsletter-message').textContent = 'Đã ghi nhận email. Bản tin sẽ được thông báo khi ra mắt.';
    form.reset();
  } catch (error) { $('#newsletter-message').textContent = error.message; }
});

const menuButton = $('.mobile-menu');
const nav = $('#main-nav');
menuButton.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
$$('#main-nav a').forEach((link) => link.addEventListener('click', () => { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));

async function restoreSession() {
  try { user = (await api(`${AUTH_API}/me`)).user; await loadProfile(); }
  catch { user = null; }
  renderUser();
  if (!user && new URLSearchParams(location.search).get('login') === '1') showLogin();
}
$('#today-label').textContent = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date());
loadProblems();
loadFeaturedSolutions();
loadVideos();
restoreSession();

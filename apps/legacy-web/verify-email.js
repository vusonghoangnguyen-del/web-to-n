const message = document.querySelector('#verify-message');
const home = document.querySelector('#verify-home');
const token = new URLSearchParams(location.search).get('token');

async function verify() {
  if (!token) throw new Error('Liên kết xác minh không có token.');
  const response = await fetch('/api/v1/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || 'Không thể xác minh email.');
  message.textContent = `Email đã được xác minh. Chào ${data.user.name}!`;
  home.hidden = false;
  history.replaceState(null, '', '/verify-email.html');
}

verify().catch((error) => {
  message.textContent = error.message;
  home.hidden = false;
});

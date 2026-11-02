const form = document.querySelector('#resend-form');
const emailInput = document.querySelector('#resend-email');
const emailLabel = document.querySelector('#pending-email');
const button = document.querySelector('#resend-button');
const message = document.querySelector('#resend-message');
let countdownTimer;

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'email đăng ký';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function startCooldown(sentAt = Date.now()) {
  sessionStorage.setItem('verificationEmailSentAt', String(sentAt));
  clearInterval(countdownTimer);
  const update = () => {
    const remaining = Math.max(0, 60 - Math.floor((Date.now() - sentAt) / 1000));
    button.disabled = remaining > 0;
    button.textContent = remaining > 0 ? `Có thể gửi lại sau ${remaining}s` : 'Gửi lại email xác minh';
    if (remaining === 0) clearInterval(countdownTimer);
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

const savedEmail = sessionStorage.getItem('pendingVerificationEmail') || '';
emailInput.value = savedEmail;
emailLabel.textContent = maskEmail(savedEmail);
const lastSentAt = Number(sessionStorage.getItem('verificationEmailSentAt'));
if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < 60_000) startCooldown(lastSentAt);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  button.disabled = true;
  message.textContent = 'Đang gửi email…';
  try {
    const response = await fetch('/api/v1/auth/email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Không thể gửi lại email xác minh.');
    sessionStorage.setItem('pendingVerificationEmail', email);
    emailLabel.textContent = maskEmail(email);
    message.textContent = data.message;
    startCooldown();
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

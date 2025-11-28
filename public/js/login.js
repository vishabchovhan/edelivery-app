document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Logging in...';
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      statusEl.textContent = data.error || 'Login failed';
      return;
    }
    window.location.href = '/admin';
  } catch (err) {
    statusEl.textContent = 'Network error';
  }
});

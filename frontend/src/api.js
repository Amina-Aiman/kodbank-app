const API_BASE = '/api';

export async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail ? `${data.error}: ${data.detail}` : (data.error || res.statusText || 'Request failed');
    throw new Error(msg);
  }
  return data;
}

export async function register({ name, email, password, confirmPassword, address, dateOfBirth }) {
  return api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, confirmPassword, address, dateOfBirth }),
  });
}

export async function login(email, password) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return api('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return api('/auth/me');
}

export async function getBalance() {
  return api('/bank/balance');
}

export async function getRecipient(email) {
  return api(`/bank/recipient?email=${encodeURIComponent(email)}`);
}

export async function getTransactions() {
  return api('/bank/transactions');
}

export async function transfer(to_email, amount) {
  return api('/bank/transfer', {
    method: 'POST',
    body: JSON.stringify({ to_email, amount: Number(amount) }),
  });
}

export async function sendAIChat(message, history = []) {
  return api('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
}

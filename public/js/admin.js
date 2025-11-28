async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

async function loadMe() {
  const meEl = document.getElementById('me');
  try {
    const data = await api('/auth/me');
    meEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    meEl.textContent = 'Not authenticated';
    window.location.href = '/login.html';
  }
}

async function createDriver() {
  const name = document.getElementById('driver-name').value;
  const notes = document.getElementById('driver-notes').value;
  const resultEl = document.getElementById('driver-result');
  resultEl.textContent = 'Creating...';
  try {
    const data = await api('/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, notes })
    });
    resultEl.textContent = JSON.stringify(data, null, 2);
    await loadDrivers();
  } catch (err) {
    resultEl.textContent = err.message;
  }
}

async function loadDrivers() {
  const body = document.getElementById('drivers-body');
  const select = document.getElementById('assigned-driver');
  if (body) body.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
  try {
    const drivers = await api('/api/drivers');
    if (body) body.innerHTML = '';
    if (select) {
      select.innerHTML = '<option value="">-- select driver --</option>';
    }
    drivers.forEach((d) => {
      if (body) {
        const link = `${window.location.origin}/magic-login/${d.magicToken}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${d.name || '(no name)'}</td><td>${d.notes || ''}</td><td><a href="${link}" target="_blank">Magic Link</a></td>`;
        body.appendChild(tr);
      }
      if (select) {
        const option = document.createElement('option');
        option.value = d.id;
        option.textContent = `${d.name || 'Driver'} (${d.id.slice(0, 6)})`;
        select.appendChild(option);
      }
    });
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="3">${err.message}</td></tr>`;
  }
}

async function createDelivery() {
  const payload = {
    customerName: document.getElementById('cust-name').value,
    invoiceNumber: document.getElementById('invoice-number').value,
    orderRef: document.getElementById('order-ref').value || null,
    deliveryDateTime: document.getElementById('delivery-datetime').value || null,
    notes: document.getElementById('delivery-notes').value || null,
    assignedDriverId: document.getElementById('assigned-driver').value || null,
    items: []
  };
  try {
    const parsed = JSON.parse(document.getElementById('items-json').value || '[]');
    payload.items = parsed;
  } catch (err) {
    document.getElementById('delivery-create-result').textContent = 'Invalid items JSON';
    return;
  }
  const resultEl = document.getElementById('delivery-create-result');
  resultEl.textContent = 'Creating...';
  try {
    const data = await api('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    resultEl.textContent = JSON.stringify(data, null, 2);
    loadDeliveries();
  } catch (err) {
    resultEl.textContent = err.message;
  }
}

async function loadDeliveries() {
  const body = document.getElementById('deliveries-body');
  body.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  try {
    const deliveries = await api('/api/deliveries');
    body.innerHTML = '';
    deliveries.forEach((d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.customerName}</td><td>${d.invoiceNumber}</td><td>${d.status}</td><td>${d.assignedDriverId || ''}</td><td>${new Date(d.createdAt).toLocaleString()}</td>`;
      body.appendChild(tr);
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5">${err.message}</td></tr>`;
  }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('create-driver-btn').addEventListener('click', createDriver);
  document.getElementById('create-delivery-btn').addEventListener('click', createDelivery);
  document.getElementById('refresh-deliveries').addEventListener('click', loadDeliveries);
  document.getElementById('refresh-drivers').addEventListener('click', loadDrivers);
  document.getElementById('logout-btn').addEventListener('click', logout);
  loadMe();
  loadDrivers();
  loadDeliveries();
});

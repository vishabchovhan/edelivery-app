let deliveryId;

function getIdFromUrl() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
}

function renderItems(items) {
  const table = document.getElementById('items-table');
  table.innerHTML = '<tr><th>Item</th><th>Ordered</th><th>Delivered</th></tr>';
  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name}</td><td>${item.qty}</td><td><input type="number" min="0" value="${item.deliveredQty ?? item.qty}" data-item-id="${item.id}" style="width:80px"></td>`;
    table.appendChild(tr);
  });
}

async function loadDelivery() {
  deliveryId = getIdFromUrl();
  const info = document.getElementById('delivery-info');
  try {
    const res = await fetch(`/api/deliveries/${deliveryId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Unable to load delivery');
    const delivery = await res.json();
    info.textContent = `${delivery.customerName} • Invoice ${delivery.invoiceNumber}`;
    renderItems(delivery.items);
  } catch (err) {
    info.textContent = 'Failed to load delivery';
  }
}

function setupSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  const ctx = canvas.getContext('2d');
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
  }
  resize();
  let drawing = false;
  const start = (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
  const move = (e) => { if (!drawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); };
  const end = () => { drawing = false; };
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); start({ offsetX: t.clientX - rect.left, offsetY: t.clientY - rect.top }); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); move({ offsetX: t.clientX - rect.left, offsetY: t.clientY - rect.top }); });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
  document.getElementById('clear-signature').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    resize();
  });
}

async function submitConfirmation() {
  const status = document.getElementById('status');
  status.textContent = 'Submitting...';
  const inputs = document.querySelectorAll('input[data-item-id]');
  const items = Array.from(inputs).map((input) => ({ id: input.dataset.itemId, deliveredQty: Number(input.value || 0) }));
  const formData = new FormData();
  formData.append('items', JSON.stringify(items));
  const photo = document.getElementById('photo').files[0];
  if (photo) formData.append('photo', photo);
  const signatureDataUrl = document.getElementById('signature-pad').toDataURL('image/png');
  formData.append('signatureDataUrl', signatureDataUrl);

  try {
    const res = await fetch(`/api/deliveries/${deliveryId}/confirm`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    status.textContent = 'Delivery confirmed!';
  } catch (err) {
    status.textContent = err.message;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadDelivery();
  setupSignaturePad();
  document.getElementById('submit-btn').addEventListener('click', submitConfirmation);
});

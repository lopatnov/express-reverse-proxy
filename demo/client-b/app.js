const output = document.getElementById('response-output');
const statusBadge = document.getElementById('status-badge');
const clearBtn = document.getElementById('clear-btn');

async function sendRequest(apiPath, { responseType = 'json' } = {}) {
  output.textContent = 'Loading…';
  statusBadge.className = 'status-badge';
  statusBadge.textContent = '';

  try {
    const res = await fetch(apiPath);
    const contentType = res.headers.get('content-type') || '';
    const asText =
      responseType === 'text' ||
      (responseType === 'json' && !contentType.includes('application/json'));
    const body = asText ? await res.text() : JSON.stringify(await res.json(), null, 2);

    output.textContent = body;
    statusBadge.textContent = `${res.status} ${res.statusText}`;
    statusBadge.className = `status-badge ${res.ok ? 'ok' : 'err'}`;
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
    statusBadge.textContent = 'Error';
    statusBadge.className = 'status-badge err';
  }

  clearBtn.hidden = false;
}

document.querySelectorAll('.btn[data-path]').forEach((btn) => {
  btn.addEventListener('click', () =>
    sendRequest(btn.dataset.path, { responseType: btn.dataset.response || 'json' }),
  );
});

clearBtn.addEventListener('click', () => {
  output.innerHTML = '<span class="placeholder">← Click a button to send an API request</span>';
  statusBadge.className = 'status-badge';
  statusBadge.textContent = '';
  clearBtn.hidden = true;
});

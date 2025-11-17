const baseInput = document.getElementById('base-url');
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');

async function restoreSettings() {
  const { foodexBaseUrl } = await chrome.storage.sync.get('foodexBaseUrl');
  if (foodexBaseUrl) baseInput.value = foodexBaseUrl;
}

function setStatus(message, detail) {
  statusEl.innerHTML = detail ? `<strong>${message}</strong>${detail}` : `<strong>${message}</strong>`;
}

startBtn.addEventListener('click', async () => {
  const url = baseInput.value.trim();
  if (!url) {
    setStatus('Missing dashboard URL', 'Example: https://dashboard.mariontrading.com');
    return;
  }

  await chrome.storage.sync.set({ foodexBaseUrl: url });
  startBtn.disabled = true;
  setStatus('Starting…', 'Fetching products and attaching to the active tab.');

  chrome.runtime.sendMessage({ type: 'foodex-start', baseUrl: url }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus('Extension error', chrome.runtime.lastError.message);
      startBtn.disabled = false;
      return;
    }

    if (response && response.ok) {
      setStatus('Helper running', 'Please leave the popup open until it finishes.');
    } else {
      setStatus('Cannot start helper', response?.error || 'Unknown error');
      startBtn.disabled = false;
    }
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'foodex-progress') {
    setStatus(`Scraping ${message.current}/${message.total}`, message.note || 'Working…');
  }
  if (message.type === 'foodex-complete') {
    setStatus('Finished', `${message.updated} price${message.updated === 1 ? '' : 's'} updated.`);
    startBtn.disabled = false;
  }
  if (message.type === 'foodex-error') {
    setStatus('Helper failed', message.message || 'Unknown error');
    startBtn.disabled = false;
  }
});

restoreSettings().catch(() => {
  /* ignore */
});

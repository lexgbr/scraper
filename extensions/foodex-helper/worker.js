const state = {
  running: false,
  abortController: null,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'foodex-start') {
    if (state.running) {
      sendResponse({ ok: false, error: 'Already scraping. Please wait.' });
      return true;
    }
    const baseUrl = normalizeBaseUrl(message.baseUrl);
    if (!baseUrl) {
      sendResponse({ ok: false, error: 'Invalid dashboard URL.' });
      return true;
    }

    runFoodexCapture(baseUrl).catch((err) => {
      console.error('[foodex-helper] fatal', err);
      chrome.runtime.sendMessage({ type: 'foodex-error', message: err?.message || String(err) });
    });

    sendResponse({ ok: true });
    return true;
  }

  return false;
});

function normalizeBaseUrl(input) {
  try {
    const parsed = new URL(input);
    return parsed.origin;
  } catch {
    return null;
  }
}

async function runFoodexCapture(baseUrl) {
  state.running = true;
  state.abortController = new AbortController();
  let updated = 0;

  try {
    const tab = await getActiveTab();
    if (!tab) throw new Error('No active tab found. Open the Foodex tab and try again.');

    const list = await fetch(`${baseUrl}/api/manual/foodex`, {
      method: 'GET',
      signal: state.abortController.signal,
    }).then((res) => res.json());

    const links = Array.isArray(list?.links) ? list.links : [];
    if (links.length === 0) throw new Error('No Foodex products found in the dashboard.');

    const results = [];
    let current = 0;

    for (const link of links) {
      current += 1;
      if (!link?.url || !link?.id) continue;
      chrome.runtime.sendMessage({
        type: 'foodex-progress',
        current,
        total: links.length,
        note: link.productName || link.url,
      });

      const priceText = await navigateAndRead(tab.id, link.url, link.selector);
      if (!priceText) continue;
      const amount = parseGBP(priceText);
      if (amount == null) continue;
      results.push({ id: link.id, unitPrice: amount });
    }

    if (results.length > 0) {
      await fetch(`${baseUrl}/api/manual/foodex`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: results }),
        signal: state.abortController.signal,
      });
      updated = results.length;
    }

    chrome.runtime.sendMessage({ type: 'foodex-complete', updated });
  } catch (err) {
    chrome.runtime.sendMessage({
      type: 'foodex-error',
      message: err?.message || 'Unexpected error while scraping.',
    });
  } finally {
    state.running = false;
    if (state.abortController) state.abortController.abort();
    state.abortController = null;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function waitForTab(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out while loading the product page.'));
    }, 45000);

    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigateAndRead(tabId, url, selector) {
  await chrome.tabs.update(tabId, { url });
  await waitForTab(tabId);
  await delay(1000);

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [selector],
    func: (sel) => {
      const element = sel ? document.querySelector(sel) : null;
      if (element) return element.textContent?.trim() || null;
      const fallback = document.querySelector('[class*="price"]');
      return fallback?.textContent?.trim() || null;
    },
  });

  return result;
}

function parseGBP(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/,/g, '')
      : cleaned.includes(',') && !cleaned.includes('.')
        ? cleaned.replace(',', '.')
        : cleaned;
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) return null;
  return Number(amount.toFixed(2));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {};

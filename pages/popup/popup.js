import { t, applyI18n, loadLanguage, loadTheme, watchSystemTheme } from '../../utils/i18n.js';
import { ACTION } from '../../utils/actions.js';

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadLanguage();
  applyI18n();

  const { settings = {} } = await chrome.storage.local.get('settings');
  watchSystemTheme(settings.theme || 'system');

  document.getElementById('apiKeyBanner').hidden = !!settings.apiKey;

  // Show platform-appropriate shortcut hint
  const isMac = navigator.platform.includes('Mac');
  document.getElementById('shortcutHint').textContent = isMac ? '⌘⇧S' : 'Ctrl+Shift+S';

  renderHistory();
});

// --- Event Listeners ---
document.getElementById('captureBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: ACTION.START_CAPTURE_MODE }, (response) => {
    void chrome.runtime.lastError;
    if (!response?.ok) showCancelMode(false);
  });
  showCancelMode(true);
});

document.getElementById('cancelCaptureBtn').addEventListener('click', () => {
  cancelCapture();
});

// ESC in Side Panel also cancels
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cancelCapture();
});

function cancelCapture() {
  showCancelMode(false);
  // Notify background to reset captureInProgress lock
  chrome.runtime.sendMessage({ action: ACTION.CANCEL_CAPTURE }).catch(() => {});
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: ACTION.CANCEL_CAPTURE }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
}

function showCancelMode(active) {
  document.getElementById('captureBtn').hidden = active;
  document.getElementById('cancelCaptureBtn').hidden = !active;
}
document.getElementById('clearHistory')?.addEventListener('click', clearHistory);
document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
document.getElementById('bannerSettingsBtn')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// --- Listen for background messages ---
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === ACTION.RESULTS_READY) {
    showCancelMode(false);
    clearError();
    renderHistory();
  }
  if (message.action === ACTION.EXTRACTION_ERROR) {
    showCancelMode(false);
    showError(message.error);
  }
  if (message.action === ACTION.CAPTURE_MODE_CHANGED) {
    if (message.active) clearError();
    showCancelMode(message.active);
  }
  if (message.action === ACTION.SETTINGS_CHANGED) {
    loadTheme().then(() => loadLanguage()).then(() => {
      applyI18n();
      chrome.storage.local.get('settings', ({ settings = {} }) => {
        document.getElementById('apiKeyBanner').hidden = !!settings.apiKey;
      });
    });
  }
});

// --- History ---
async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  const section = document.getElementById('historySection');
  const list = document.getElementById('historyList');

  section.hidden = false;
  list.replaceChildren();

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = t('popup.historyEmpty');
    list.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const textEl = document.createElement('div');
    textEl.className = 'history-card-text';
    textEl.textContent = entry.text;

    const meta = document.createElement('div');
    meta.className = 'history-card-meta';
    let hostname = '';
    try { hostname = entry.url ? new URL(entry.url).hostname : ''; } catch { /* invalid URL */ }
    const hostSpan = document.createElement('span');
    hostSpan.textContent = hostname;
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTimeAgo(entry.timestamp);
    meta.appendChild(hostSpan);
    meta.appendChild(timeSpan);

    card.appendChild(textEl);
    card.appendChild(meta);

    const copyEntry = () => {
      copyToClipboard(entry.text);
      let badge = card.querySelector('.history-card-copied');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'history-card-copied';
        badge.textContent = t('popup.copied');
        card.appendChild(badge);
      }
      badge.hidden = false;
      setTimeout(() => { badge.hidden = true; }, 1200);
    };

    card.addEventListener('click', copyEntry);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyEntry();
      }
    });

    list.appendChild(card);
  });

}

async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
  renderHistory();
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('time.now');
  if (mins < 60) return `${mins}${t('time.minute')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${t('time.hour')}`;
  return `${Math.floor(hours / 24)}${t('time.day')}`;
}

// --- Helpers ---
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function clearError() {
  document.getElementById('errorBox').hidden = true;
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  if (msg.startsWith('error.')) {
    const [key, detail] = msg.split('::');
    // Truncate long API error details for readability
    const shortDetail = detail && detail.length > 100 ? detail.slice(0, 100) + '...' : detail;
    box.textContent = shortDetail ? t(key, { detail: shortDetail }) : t(key);
  } else {
    box.textContent = msg;
  }
  box.hidden = false;

  // Persistent errors stay visible (user needs to act); transient errors auto-dismiss
  const persistent = ['error.noApiKey', 'error.invalidApiKey', 'error.apiError', 'error.quotaExceeded', 'error.blocked'];
  if (!persistent.some(k => msg.startsWith(k))) {
    setTimeout(() => { box.hidden = true; }, 5000);
  }
}



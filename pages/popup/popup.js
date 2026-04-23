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
    card.setAttribute('aria-label', t('popup.cardAriaLabel'));

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

    // Action buttons (top-right, hover-visible)
    const actionsRow = document.createElement('div');
    actionsRow.className = 'history-card-tools';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'history-card-edit';
    editBtn.setAttribute('aria-label', t('popup.edit'));
    editBtn.title = t('popup.edit');
    editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8.5 8.5H2.5v-3z"/></svg>';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'history-card-delete';
    deleteBtn.setAttribute('aria-label', t('popup.delete'));
    deleteBtn.title = t('popup.delete');
    deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V2.5h4V4M5 4v9.5h6V4M7 6.5v5M9 6.5v5"/></svg>';

    actionsRow.appendChild(editBtn);
    actionsRow.appendChild(deleteBtn);

    card.appendChild(textEl);
    card.appendChild(meta);
    card.appendChild(actionsRow);

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

    const enterEditMode = () => {
      card.classList.add('editing');
      // Strip click-to-copy semantics while editing — avoid stale/misleading a11y hints
      card.removeAttribute('role');
      card.removeAttribute('aria-label');
      card.removeAttribute('tabindex');
      textEl.hidden = true;

      const editor = document.createElement('textarea');
      editor.className = 'history-card-editor';
      editor.value = entry.text;
      editor.setAttribute('aria-label', t('popup.editAriaLabel'));

      const actions = document.createElement('div');
      actions.className = 'history-card-actions';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'history-card-save';
      saveBtn.textContent = t('popup.save');
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'history-card-cancel';
      cancelBtn.textContent = t('popup.cancel');
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);

      card.insertBefore(editor, meta);
      card.insertBefore(actions, meta);
      editor.focus();
      editor.select();

      const cleanup = () => renderHistory();

      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newText = editor.value.trim();
        if (newText && newText !== entry.text) {
          await updateHistoryEntry(entry.timestamp, newText);
          copyToClipboard(newText);
        }
        cleanup();
      });
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup();
      });
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Prevent bubbling to document-level Escape handler (cancelCapture)
          e.preventDefault();
          e.stopPropagation();
          cleanup();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBtn.click(); }
      });
    };

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterEditMode();
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteHistoryEntry(entry.timestamp);
      renderHistory();
    });

    card.addEventListener('click', (e) => {
      if (card.classList.contains('editing')) return;
      if (e.target.closest('.history-card-tools')) return;
      copyEntry();
    });
    card.addEventListener('keydown', (e) => {
      if (card.classList.contains('editing')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyEntry();
      }
    });

    list.appendChild(card);
  });

}

async function updateHistoryEntry(originalTimestamp, newText) {
  // Look up by the entry's original timestamp — index would be stale if a new
  // capture shifted the array between render and save.
  const { history = [] } = await chrome.storage.local.get('history');
  const idx = history.findIndex(h => h.timestamp === originalTimestamp);
  if (idx === -1) return;
  history[idx] = { ...history[idx], text: newText };
  await chrome.storage.local.set({ history });
}

async function deleteHistoryEntry(originalTimestamp) {
  const { history = [] } = await chrome.storage.local.get('history');
  const filtered = history.filter(h => h.timestamp !== originalTimestamp);
  if (filtered.length === history.length) return;
  await chrome.storage.local.set({ history: filtered });
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
  const persistent = ['error.noApiKey', 'error.invalidApiKey', 'error.quotaExceeded', 'error.blocked'];
  if (!persistent.some(k => msg.startsWith(k))) {
    setTimeout(() => { box.hidden = true; }, 5000);
  }
}



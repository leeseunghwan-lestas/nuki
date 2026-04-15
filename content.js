(() => {
  // Inline copy of ACTION constants from utils/actions.js — keep in sync
  // Only includes actions used by content.js (others omitted intentionally)
  const ACTION = {
    CAPTURE_AREA: 'captureArea',
    START_CAPTURE: 'startCapture',
    START_CAPTURE_MODE: 'startCaptureMode',
    CANCEL_CAPTURE: 'cancelCapture',
    CAPTURE_MODE_CHANGED: 'captureModeChanged',
    COPY_AND_NOTIFY: 'copyAndNotify',
    SHOW_NOTIFY: 'showNotify',
    SETTINGS_CHANGED: 'settingsChanged',
    RESULTS_READY: 'resultsReady',
    EXTRACTION_ERROR: 'extractionError',
    CROP_IMAGE: 'cropImage',
  };

  // Safe wrapper — silently fails if extension context is invalidated (after reload)
  function safeSendMessage(msg) {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {}
  }

  // Remove previous listener on extension reload (old listener is dead)
  if (window.__kcListener) {
    try { chrome.runtime.onMessage.removeListener(window.__kcListener); } catch {}
  }

  window.__kcListener = (message, _sender, sendResponse) => {
    if (message.action === ACTION.COPY_AND_NOTIFY) {
      navigator.clipboard.writeText(message.text).then(() => {
        showCenterModal(message.message);
      }).catch(() => {
        fallbackCopy(message.text);
        showCenterModal(message.message);
      });
      sendResponse({ ok: true });
      return false;
    }

    if (message.action === ACTION.START_CAPTURE) {
      startCaptureMode(message.label);
      safeSendMessage({ action: ACTION.CAPTURE_MODE_CHANGED, active: true });
      sendResponse({ ok: true });
      return false;
    }

    if (message.action === ACTION.CANCEL_CAPTURE) {
      const overlay = document.getElementById('kc-capture-overlay');
      if (overlay) overlay.remove();
      sendResponse({ ok: true });
      return false;
    }

    if (message.action === ACTION.SHOW_NOTIFY) {
      showPageToast(message.message, message.type || 'info');
      sendResponse({ ok: true });
      return false;
    }
  };

  chrome.runtime.onMessage.addListener(window.__kcListener);

  // --- Clipboard fallback ---
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // Resolve dark mode from extension settings (falls back to system preference)
  function resolveIsDark() {
    return new Promise((resolve) => {
      try {
        chrome.storage?.local?.get('settings', ({ settings = {} }) => {
          if (chrome.runtime.lastError || !settings.theme) {
            resolve(window.matchMedia('(prefers-color-scheme: dark)').matches);
            return;
          }
          if (settings.theme === 'dark') resolve(true);
          else if (settings.theme === 'light') resolve(false);
          else resolve(window.matchMedia('(prefers-color-scheme: dark)').matches);
        });
      } catch {
        resolve(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    });
  }

  // --- Center Modal (copy confirmation) ---
  async function showCenterModal(message) {
    const loadingToast = document.getElementById('kc-toast');
    if (loadingToast) loadingToast.remove();

    const existing = document.getElementById('kc-center-modal');
    if (existing) existing.remove();

    const isDark = await resolveIsDark();

    const modal = document.createElement('div');
    modal.id = 'kc-center-modal';
    const icon = document.createElement('span');
    icon.style.cssText = `font-size:26px;color:${isDark ? '#34d399' : '#10b981'};`;
    icon.textContent = '\u2713';
    const text = document.createElement('span');
    text.textContent = message;
    modal.appendChild(icon);
    modal.appendChild(text);
    modal.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      z-index: 2147483647;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 28px 44px;
      background: ${isDark ? 'rgba(12, 14, 20, 0.88)' : 'rgba(255, 255, 255, 0.92)'};
      color: ${isDark ? '#e2e5eb' : '#111318'};
      border: 1px solid ${isDark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(16, 185, 129, 0.15)'};
      border-radius: 16px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 15px; font-weight: 600; letter-spacing: 0.01em;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: ${isDark
        ? '0 16px 48px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)'
        : '0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)'};
      opacity: 0; transition: opacity 0.25s cubic-bezier(0.22,1,0.36,1), transform 0.25s cubic-bezier(0.22,1,0.36,1);
      pointer-events: none;
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    setTimeout(() => {
      modal.style.opacity = '0';
      modal.style.transform = 'translate(-50%, -50%) scale(0.8)';
      setTimeout(() => modal.remove(), 200);
    }, 1200);
  }

  // --- Page Toast (loading/error/warning) ---
  async function showPageToast(message, type) {
    const existing = document.getElementById('kc-toast');
    if (existing) existing.remove();

    const isDark = await resolveIsDark();

    const icons = {
      loading: '\u2699', success: '\u2713', warning: '\u26A0',
      error: '\u2717', info: '\u2139',
    };

    const colors = isDark
      ? { loading: '#34d399', success: '#34d399', warning: '#fbbf24', error: '#f87171', info: '#7a7f94' }
      : { loading: '#10b981', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#5c6070' };

    const bg = isDark ? 'rgba(20, 23, 32, 0.92)' : 'rgba(255, 255, 255, 0.95)';
    const textColor = isDark ? '#e2e5eb' : '#111318';
    const borderColor = colors[type] || colors.info;
    const iconColor = colors[type] || colors.info;
    const shadow = isDark
      ? '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)'
      : '0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)';

    const toast = document.createElement('div');
    toast.id = 'kc-toast';
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = `font-size:16px;color:${iconColor};flex-shrink:0;${type === 'loading' ? 'animation:kc-spin 1s linear infinite;display:inline-block;' : ''}`;
    iconSpan.textContent = icons[type] || icons.info;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      display: flex; align-items: center; gap: 10px; padding: 11px 18px;
      background: ${bg}; color: ${textColor};
      border-left: 2px solid ${borderColor}; border-radius: 10px;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px; font-weight: 500; letter-spacing: 0.01em;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: ${shadow};
      opacity: 0; transform: translateY(-8px); transition: opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1);
    `;

    if (!document.getElementById('kc-toast-style')) {
      const style = document.createElement('style');
      style.id = 'kc-toast-style';
      style.textContent = '@keyframes kc-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    if (type !== 'loading') {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    }
  }

  // --- Capture Mode (area selection) ---
  function startCaptureMode(labelText) {
    const existing = document.getElementById('kc-capture-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'kc-capture-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2147483646; cursor: crosshair; background: rgba(12, 14, 20, 0.1);
    `;

    const selBox = document.createElement('div');
    selBox.style.cssText = `
      position: fixed; border: 1.5px solid #34d399;
      background: rgba(52, 211, 153, 0.06);
      border-radius: 3px; display: none;
      box-shadow: 0 0 0 9999px rgba(12, 14, 20, 0.3);
    `;
    overlay.appendChild(selBox);

    const labelBar = document.createElement('div');
    labelBar.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px 8px 14px;
      background: rgba(12, 14, 20, 0.82); color: #e2e5eb;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; font-size: 12px; font-weight: 500;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      letter-spacing: 0.01em;
    `;
    const labelText2 = document.createElement('span');
    labelText2.textContent = labelText || 'Drag to select area';
    const cancelBtn = document.createElement('span');
    cancelBtn.textContent = '✕';
    cancelBtn.style.cssText = `
      cursor: pointer; padding: 2px 8px; border-radius: 6px;
      font-size: 13px; font-weight: 500; opacity: 0.5;
      transition: opacity 0.15s, background 0.15s;
    `;
    cancelBtn.addEventListener('mouseover', () => { cancelBtn.style.opacity = '1'; cancelBtn.style.background = 'rgba(255,255,255,0.08)'; });
    cancelBtn.addEventListener('mouseout', () => { cancelBtn.style.opacity = '0.5'; cancelBtn.style.background = 'none'; });
    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancel(); });
    labelBar.appendChild(labelText2);
    labelBar.appendChild(cancelBtn);
    overlay.appendChild(labelBar);

    let startX, startY, dragging = false;

    overlay.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
      selBox.style.display = 'block';
      selBox.style.left = startX + 'px';
      selBox.style.top = startY + 'px';
      selBox.style.width = '0px';
      selBox.style.height = '0px';
      e.preventDefault();
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      selBox.style.left = Math.min(startX, e.clientX) + 'px';
      selBox.style.top = Math.min(startY, e.clientY) + 'px';
      selBox.style.width = Math.abs(e.clientX - startX) + 'px';
      selBox.style.height = Math.abs(e.clientY - startY) + 'px';
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;

      const rect = {
        x: Math.min(startX, e.clientX),
        y: Math.min(startY, e.clientY),
        w: Math.abs(e.clientX - startX),
        h: Math.abs(e.clientY - startY),
      };

      overlay.remove();
      document.removeEventListener('keydown', onKeyDoc);
      safeSendMessage({ action: ACTION.CAPTURE_MODE_CHANGED, active: false });

      if (rect.w < 10 || rect.h < 10) return;

      setTimeout(() => {
        safeSendMessage({
          action: ACTION.CAPTURE_AREA,
          rect,
          devicePixelRatio: window.devicePixelRatio || 1,
        });
      }, 50);
    });

    const cancel = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDoc);
      safeSendMessage({ action: ACTION.CAPTURE_MODE_CHANGED, active: false });
    };
    const onKeyDoc = (e) => { if (e.key === 'Escape') cancel(); };
    document.addEventListener('keydown', onKeyDoc);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel(); });

    overlay.tabIndex = 0;
    document.body.appendChild(overlay);

    // Aggressively grab focus from Side Panel
    window.focus();
    overlay.focus();
    const focusAttempts = [100, 300, 600];
    focusAttempts.forEach(ms => {
      setTimeout(() => {
        if (document.getElementById('kc-capture-overlay')) {
          window.focus();
          overlay.focus();
        }
      }, ms);
    });
  }
})();

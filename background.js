import { geminiOcr, resolveModel } from './utils/gemini.js';
import { ACTION } from './utils/actions.js';
import { MAX_HISTORY_ENTRIES } from './utils/constants.js';

// --- Localized messages (Service Worker can't use i18n module) ---
const messages = {
  en: {
    extracting: 'Extracting...',
    copied: 'Copied!',
    noText: 'No text found',
    dragToSelect: 'Drag to select area · ESC to cancel',
    'error.noApiKey': 'API key not configured. Please set it in Settings.',
    'error.invalidApiKey': 'API key is invalid. Open Settings and re-check — it may be mistyped, revoked, or not a Gemini API key.',
    'error.emptyResponse': 'No text found in the captured area. Try selecting a larger area.',
    'error.network': 'Network error. Please check your connection.',
    'error.protectedPage': 'Cannot capture this page.',
    'error.cropFailed': 'Failed to process the captured image.',
    'error.apiError': 'Unexpected API response. Please try again in a moment.',
    'error.quotaExceeded': 'API quota exceeded. Please wait a moment or check your plan.',
    'error.rateLimited': 'Too many requests in a short time. Please wait a moment and try again.',
    'error.serverError': 'Gemini is temporarily unavailable. Please try again shortly.',
    'error.blocked': 'This content was blocked by the AI safety filter. Try a different area.',
    'error.unknown': 'An unexpected error occurred.',
    'error.ocr.no_text': 'No text found in this area.',
    'error.ocr.blurry': 'Image is too blurry to read. Try zooming in first.',
    'error.ocr.too_small': 'Text is too small to extract. Try selecting a larger area.',
    'error.ocr.low_contrast': 'Text contrast is too low to read clearly.',
    'error.ocr.partial': 'Only partial text could be read. Try a clearer area.',
  },
  ja: {
    extracting: '抽出中...',
    copied: 'コピーしました！',
    noText: 'テキストが見つかりません',
    dragToSelect: '範囲をドラッグして選択 · ESCでキャンセル',
    'error.noApiKey': 'APIキーが設定されていません。設定画面で入力してください。',
    'error.invalidApiKey': 'APIキーが無効です。設定画面でご確認ください — 入力ミス、無効化、または Gemini 用でないキーの可能性があります。',
    'error.emptyResponse': 'キャプチャした範囲にテキストが見つかりません。もう少し広い範囲を選択してください。',
    'error.network': 'ネットワークエラーです。接続を確認してください。',
    'error.protectedPage': 'このページはキャプチャできません。',
    'error.cropFailed': 'キャプチャ画像の処理に失敗しました。',
    'error.apiError': '予期しない API 応答を受信しました。しばらくしてから再度お試しください。',
    'error.quotaExceeded': 'API使用量の上限に達しました。しばらく待つか、プランを確認してください。',
    'error.rateLimited': '短時間のリクエストが多すぎます。少し待ってから再度お試しください。',
    'error.serverError': 'Gemini サーバーが一時的にご利用いただけません。しばらくしてから再度お試しください。',
    'error.blocked': 'AIのセーフティフィルターによりブロックされました。別の範囲をお試しください。',
    'error.unknown': '予期しないエラーが発生しました。',
    'error.ocr.no_text': 'この範囲にテキストが見つかりません。',
    'error.ocr.blurry': '画像がぼやけて読み取れません。先にズームインしてみてください。',
    'error.ocr.too_small': 'テキストが小さすぎます。もう少し広い範囲を選択してください。',
    'error.ocr.low_contrast': 'テキストのコントラストが低く、読み取れません。',
    'error.ocr.partial': '一部のテキストしか読み取れませんでした。',
  },
};

async function getMsg(key) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const lang = settings.language || 'en';
  return (messages[lang] || messages.en)[key] || messages.en[key];
}

// Translate error codes (e.g. "error.invalidApiKey") to user-friendly messages.
// Legacy "key::detail" format is still handled by split in case any throw re-adds it.
async function localizeError(errMsg) {
  if (!errMsg) return await getMsg('error.unknown');
  const [key, detail] = errMsg.split('::');
  const translated = await getMsg(key);
  if (translated && translated !== key) {
    return detail ? translated + detail : translated;
  }
  return errMsg;
}

// --- Capture lock (per-tab, prevents concurrent extractions on same tab) ---
const activeCaptures = new Set();

// Pages Chrome blocks extensions from — captureVisibleTab/executeScript will fail
function isCapturableUrl(url) {
  if (!url) return false;
  const blockedSchemes = ['chrome://', 'chrome-extension://', 'devtools://', 'view-source:', 'about:'];
  if (blockedSchemes.some(p => url.startsWith(p))) return false;
  if (url.startsWith('https://chromewebstore.google.com')) return false;
  return true;
}

// --- Side Panel Setup + Pre-warm Offscreen ---
chrome.runtime.onInstalled.addListener((details) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  ensureOffscreen();

  // Open welcome page on first install only (not on updates)
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'pages/welcome/welcome.html' });
  }

  // Inject content script into all existing tabs (they missed manifest auto-injection)
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      }).catch(() => {});
    }
  });
});

// --- Keyboard Shortcut ---
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-area') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    if (!isCapturableUrl(tab.url)) {
      notifyTab(tab.id, await getMsg('error.protectedPage'), 'error');
      return;
    }
    await injectContentScript(tab.id);
    const label = await getMsg('dragToSelect');
    await sendMessageToTab(tab.id, { action: ACTION.START_CAPTURE, label });
  }
});

// --- Message Handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTION.SETTINGS_CHANGED) {
    broadcastToPopup({ action: ACTION.SETTINGS_CHANGED });
    return false;
  }

  // Forward to popup/side panel — not handled by background
  if (message.action === ACTION.CAPTURE_MODE_CHANGED) {
    broadcastToPopup(message);
    return false;
  }

  if (message.action === ACTION.CANCEL_CAPTURE) {
    // Clear active capture for sender's tab (or all if no sender tab)
    const tabId = sender.tab?.id;
    if (tabId) activeCaptures.delete(tabId);
    else activeCaptures.clear();
    return false;
  }

  if (message.action === ACTION.CAPTURE_AREA) {
    const tabId = sender.tab?.id;
    if (tabId) {
      captureAreaExtraction(tabId, message.rect, message.devicePixelRatio).catch(() => {});
      sendResponse({ received: true });
    } else {
      sendResponse({ received: false });
    }
    return false;
  }

  if (message.action === ACTION.START_CAPTURE_MODE) {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false });
      if (!isCapturableUrl(tab.url)) {
        const msg = await getMsg('error.protectedPage');
        broadcastToPopup({ action: ACTION.EXTRACTION_ERROR, error: 'error.protectedPage' });
        notifyTab(tab.id, msg, 'error');
        return sendResponse({ ok: false, reason: 'protectedPage' });
      }
      await chrome.tabs.update(tab.id, { active: true });
      await injectContentScript(tab.id);
      const label = await getMsg('dragToSelect');
      await sendMessageToTab(tab.id, { action: ACTION.START_CAPTURE, label });
      sendResponse({ ok: true });
    })();
    return true; // Keep service worker alive until async work completes
  }
});

// --- Area Capture Extraction ---
async function captureAreaExtraction(tabId, rect, devicePixelRatio) {
  if (activeCaptures.has(tabId)) return;
  activeCaptures.add(tabId);

  try {
    const tabMeta = await chrome.tabs.get(tabId).catch(() => null);
    // Tab was closed mid-capture — silent exit, but reset side-panel UI
    // so the "cancel" button doesn't stay stuck indefinitely
    if (!tabMeta) {
      broadcastToPopup({ action: ACTION.RESULTS_READY });
      return;
    }
    if (!isCapturableUrl(tabMeta.url)) throw new Error('error.protectedPage');

    await injectContentScript(tabId);
    notifyTab(tabId, await getMsg('extracting'), 'loading');

    const { settings = {} } = await chrome.storage.local.get('settings');
    if (!settings.apiKey) throw new Error('error.noApiKey');

    // 1. Capture screenshot (PNG for lossless OCR accuracy)
    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    } catch (e) {
      // Chrome refuses capture when host permission is missing for the current URL
      if (/all_urls|activeTab|Cannot access/i.test(e?.message || '')) {
        throw new Error('error.protectedPage');
      }
      throw e;
    }

    // 2. Crop via offscreen document
    await ensureOffscreen();
    const cropResult = await sendMessageWithRetry({
      action: ACTION.CROP_IMAGE,
      dataUrl,
      rect,
      devicePixelRatio,
    });
    if (cropResult?.tooSmall) throw new Error('error.ocr.too_small');
    if (!cropResult?.success) throw new Error('error.cropFailed');

    // 3. OCR via Gemini
    const model = resolveModel(settings.preferredModel);
    const extractionResult = await geminiOcr(cropResult.base64, {
      apiKey: settings.apiKey,
      model,
    });

    const { status, formatted, reason } = extractionResult;
    const tab = await chrome.tabs.get(tabId);

    // Handle result based on status
    if (status === 'ok' && formatted) {
      try { await saveToHistory({ formatted, url: tab.url, timestamp: Date.now() }); } catch (e) { console.warn('Failed to save history:', e); }
      broadcastToPopup({ action: ACTION.RESULTS_READY });
      sendMessageToTab(tabId, {
        action: ACTION.COPY_AND_NOTIFY,
        text: formatted,
        message: await getMsg('copied'),
      });
    } else {
      // Extraction failed — show reason as friendly warning
      broadcastToPopup({ action: ACTION.RESULTS_READY }); // Reset popup UI
      const reasonKey = `error.ocr.${reason || 'no_text'}`;
      const warningMsg = await getMsg(reasonKey) || await getMsg('noText');
      notifyTab(tabId, warningMsg, 'warning');
    }

  } catch (err) {
    // OCR quality warnings — show as warning toast, not error
    if (err.message?.startsWith('error.ocr.')) {
      broadcastToPopup({ action: ACTION.RESULTS_READY }); // Reset popup UI
      const warningMsg = await getMsg(err.message) || await getMsg('noText');
      notifyTab(tabId, warningMsg, 'warning');
    } else {
      console.error('[nuki] captureAreaExtraction failed:', err);
      const userMsg = await localizeError(err.message);
      broadcastToPopup({ action: ACTION.EXTRACTION_ERROR, error: err.message });
      notifyTab(tabId, userMsg, 'error');
    }
  } finally {
    activeCaptures.delete(tabId);
  }
}

// --- Offscreen management ---
let offscreenPromise = null;

function ensureOffscreen() {
  if (!offscreenPromise) {
    offscreenPromise = _createOffscreenIfNeeded().finally(() => { offscreenPromise = null; });
  }
  return offscreenPromise;
}

async function _createOffscreenIfNeeded() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'pages/offscreen/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Crop image with Canvas API',
    });
    await waitForOffscreen();
  } catch (e) {
    // "Only a single offscreen document may be created" — already exists, safe to ignore
    if (!e.message?.includes('single offscreen')) throw e;
  }
}

async function waitForOffscreen(maxWait = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    if (contexts.length > 0) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function sendMessageWithRetry(message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }
  }
  throw new Error('Could not connect to offscreen document');
}

// --- Content Script Injection ---
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch {
    // Tab may be a chrome:// or other protected page — ignore
  }
}

// --- Utilities ---
function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

function broadcastToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function notifyTab(tabId, message, type) {
  chrome.tabs.sendMessage(tabId, { action: ACTION.SHOW_NOTIFY, message, type }, () => {
    void chrome.runtime.lastError;
  });
}

// --- History ---
async function saveToHistory(entry) {
  const text = entry.formatted || '';
  if (!text.trim()) return;

  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift({
    text,
    url: entry.url,
    timestamp: entry.timestamp || Date.now(),
  });
  if (history.length > MAX_HISTORY_ENTRIES) history.length = MAX_HISTORY_ENTRIES;
  await chrome.storage.local.set({ history });
}

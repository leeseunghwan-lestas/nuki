import { geminiOcr, resolveModel } from './utils/gemini.js';
import { ACTION } from './utils/actions.js';

// --- Localized messages (Service Worker can't use i18n module) ---
const messages = {
  en: {
    extracting: 'Extracting...',
    copied: 'Copied!',
    noText: 'No text found',
    dragToSelect: 'Drag to select area · ESC to cancel',
    'error.noApiKey': 'API key not configured. Please set it in Settings.',
    'error.emptyResponse': 'No text found in the captured area. Try selecting a larger area.',
    'error.network': 'Network error. Please check your connection.',
    'error.protectedPage': 'Cannot capture this page.',
    'error.cropFailed': 'Failed to process the captured image.',
    'error.apiError': 'API error: ', // localizeError() appends detail via concatenation (not placeholder)
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
    'error.emptyResponse': 'キャプチャした範囲にテキストが見つかりません。もう少し広い範囲を選択してください。',
    'error.network': 'ネットワークエラーです。接続を確認してください。',
    'error.protectedPage': 'このページはキャプチャできません。',
    'error.cropFailed': 'キャプチャ画像の処理に失敗しました。',
    'error.apiError': 'APIエラー: ',
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

// Translate error codes (e.g. "error.apiError::detail") to user-friendly messages
async function localizeError(errMsg) {
  if (!errMsg) return await getMsg('error.unknown');
  const [key, detail] = errMsg.split('::');
  const translated = await getMsg(key);
  if (translated && translated !== key) {
    return detail ? translated + detail : translated;
  }
  return errMsg;
}

// --- Capture lock (prevent concurrent extractions) ---
let captureInProgress = false;

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

  if (message.action === ACTION.CANCEL_CAPTURE) {
    captureInProgress = false;
    return false;
  }

  if (message.action === ACTION.CAPTURE_AREA) {
    const tabId = sender.tab?.id;
    if (tabId) {
      captureAreaExtraction(tabId, message.rect, message.devicePixelRatio).catch(() => {});
    }
    return false;
  }

  if (message.action === ACTION.START_CAPTURE_MODE) {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false });
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
  if (captureInProgress) return;
  captureInProgress = true;

  await injectContentScript(tabId);
  notifyTab(tabId, await getMsg('extracting'), 'loading');

  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    if (!settings.apiKey) throw new Error('error.noApiKey');

    // 1. Capture screenshot (PNG for lossless OCR accuracy)
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

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

    const { status, formatted, reason, tokenUsage } = extractionResult;
    const tab = await chrome.tabs.get(tabId);

    // 4. Track usage regardless of result
    try { await incrementUsage(tokenUsage); } catch (e) { console.warn('Failed to update usage:', e); }

    // 5. Handle result based on status
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
    if (err.message.startsWith('error.ocr.')) {
      broadcastToPopup({ action: ACTION.RESULTS_READY }); // Reset popup UI
      const warningMsg = await getMsg(err.message) || await getMsg('noText');
      notifyTab(tabId, warningMsg, 'warning');
    } else {
      const userMsg = await localizeError(err.message);
      broadcastToPopup({ action: ACTION.EXTRACTION_ERROR, error: err.message });
      notifyTab(tabId, userMsg, 'error');
    }
  } finally {
    captureInProgress = false;
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
const MAX_HISTORY = 20;

async function saveToHistory(entry) {
  const text = entry.formatted || '';
  if (!text.trim()) return;

  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift({
    text,
    url: entry.url,
    timestamp: entry.timestamp || Date.now(),
  });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await chrome.storage.local.set({ history });
}

// --- Usage tracking ---
async function incrementUsage(tokenUsage = {}) {
  const { apiUsage = {} } = await chrome.storage.local.get('apiUsage');
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Reset daily counters if day changed
  const isNewDay = apiUsage.dayKey !== dayKey;
  const dailyCount = isNewDay ? 1 : (apiUsage.dailyCount || 0) + 1;
  const dailyTokens = {
    input: (isNewDay ? 0 : (apiUsage.dailyTokens?.input || 0)) + (tokenUsage.input || 0),
    output: (isNewDay ? 0 : (apiUsage.dailyTokens?.output || 0)) + (tokenUsage.output || 0),
    total: (isNewDay ? 0 : (apiUsage.dailyTokens?.total || 0)) + (tokenUsage.total || 0),
  };

  await chrome.storage.local.set({
    apiUsage: { dailyCount, dailyTokens, dayKey }
  });
}

const translations = {
  en: {
    'popup.capture': 'Capture Area',
    'popup.cancelCapture': 'Cancel Capture',
    'popup.dragToSelect': 'Drag to select area · ESC to cancel',
    'popup.settings': 'Settings',
    'popup.historyTitle': 'Clipboard',
    'popup.clearHistory': 'Clear',
    'popup.historyEmpty': 'Press Cmd+Shift+S to capture text from screen',
    'popup.copied': 'Copied!',
    'popup.apiKeyBanner': 'Set up your Gemini API key to get started.',
    'popup.goSettings': 'Settings →',

    'options.title': 'nuki Settings',
    'options.language': 'Language',
    'options.apiKey': 'API Key',
    'options.apiKeyPlaceholder': 'AIza...',
    'options.apiKeyHint': 'Get your API key from',
    'options.apiKeyLink': 'Google AI Studio',
    'options.showHide': 'Show/Hide',
    'options.model': 'Model',
    'options.modelFlash25Lite': 'Gemini 2.5 Flash Lite',
    'options.modelFlash25LiteHint': 'Fast & free',
    'options.modelFlash25': 'Gemini 2.5 Flash',
    'options.modelFlash25Hint': 'Better accuracy',
    'options.save': 'Save',
    'options.resetDefaults': 'Reset to Defaults',
    'options.saved': 'Settings saved!',
    'options.resetDone': 'Reset to defaults',
    'options.appearance': 'Appearance',
    'options.theme': 'Theme',
    'options.themeLight': 'Light',
    'options.themeDark': 'Dark',
    'options.themeSystem': 'System',
    'options.tabApp': 'App',
    'options.tabGemini': 'Gemini API',

    'error.noApiKey': 'API key not configured. Please set it in Settings.',
    'error.invalidApiKey': 'API key is invalid. Open Settings and re-check — it may be mistyped, revoked, or not a Gemini API key.',
    'error.emptyResponse': 'No text found in the captured area. Try selecting a larger area.',
    'error.network': 'Network error. Please check your connection.',
    'error.protectedPage': 'Cannot capture this page.',
    'error.cropFailed': 'Failed to process the captured image.',
    'error.quotaExceeded': 'API quota exceeded. Please wait a moment or check your plan at Google AI Studio.',
    'error.rateLimited': 'Too many requests in a short time. Please wait a moment and try again.',
    'error.serverError': 'Gemini is temporarily unavailable. Please try again shortly.',
    'error.blocked': 'This content was blocked by the AI safety filter. Try a different area.',
    'error.unknown': 'An unexpected error occurred.',
    'error.apiError': 'API error: {detail}',
    'time.now': 'now',
    'time.minute': 'm',
    'time.hour': 'h',
    'time.day': 'd',
    'options.apiKeyInvalid': 'Invalid key format. Expected an "AIza..." key from Google AI Studio (check for extra spaces or line breaks).',

    'welcome.title': 'nuki',
    'welcome.subtitle': 'Select any area on screen. AI extracts the text instantly.',
    'welcome.flow1': 'Select area',
    'welcome.flow2': 'AI reads text',
    'welcome.flow3': 'Copied!',
    'welcome.getStarted': 'Get Started',
    'welcome.apiTitle': 'Set up your API key',
    'welcome.apiDesc': 'nuki uses Google Gemini AI to read text from images. You need a free API key to get started.',
    'welcome.getApiKey': 'Get free API key from Google AI Studio \u2192',
    'welcome.skipApiKey': 'Set up later',
    'welcome.next': 'Next',
    'welcome.back': 'Back',
    'welcome.usageTitle': 'How to use',
    'welcome.recommended': 'Recommended',
    'welcome.shortcutTitle': 'Keyboard shortcut',
    'welcome.shortcutDesc': 'Press anywhere to instantly start capturing.',
    'welcome.panelTitle': 'Side Panel',
    'welcome.panelDesc': 'Click the nuki icon, then press the Capture button.',
    'welcome.step1': 'Drag to select the area with text',
    'welcome.step2': 'AI extracts the text automatically',
    'welcome.step3': 'Text is copied to your clipboard',
    'welcome.limitTitle': "Some pages can't be captured",
    'welcome.limitDesc': 'Chrome blocks extensions from its internal pages — this is a browser-level limitation.',
    'welcome.limitTagStore': 'Web Store',
    'welcome.limitTagPdf': 'Chrome PDF viewer',
    'welcome.tipsTitle': 'Tips for best results',
    'welcome.tipsDesc': 'OCR accuracy depends on the source. Keep these in mind:',
    'welcome.tipRotated': 'Rotated or sideways text',
    'welcome.tipRotatedDesc': 'Text rotated 90° or upside down may not be recognized correctly.',
    'welcome.tipQuality': 'Low-quality images',
    'welcome.tipQualityDesc': 'Very blurry or low-resolution sources reduce accuracy.',
    'welcome.tipSmall': 'Very small text',
    'welcome.tipSmallDesc': 'If text is tiny, zoom in on the page first before capturing.',
    'welcome.tipHandwriting': 'Handwriting or cursive',
    'welcome.tipHandwritingDesc': 'Handwritten text or heavily stylized cursive has lower recognition accuracy.',
    'welcome.tipContrast': 'Low contrast or busy backgrounds',
    'welcome.tipContrastDesc': 'Text on patterned backgrounds or in colors close to the background may be missed.',
    'welcome.tipDecorative': 'Decorative or artistic fonts',
    'welcome.tipDecorativeDesc': 'Heavily ornamented, art-style, or unusual fonts may be misread.',
    'welcome.settingsTitle': 'Settings',
    'welcome.settingsDesc': 'You can change these anytime from the settings page.',
    'welcome.settingTheme': 'Theme',
    'welcome.settingThemeValue': 'Light / Dark / System',
    'welcome.settingLang': 'Language',
    'welcome.settingLangValue': 'English / Japanese',
    'welcome.settingModel': 'AI Model',
    'welcome.settingModelValue': 'Flash Lite (fast) / Flash (accurate)',
    'welcome.doneTitle': "You're all set!",
    'welcome.doneDesc': 'Open any webpage and try capturing text.',
    'welcome.finish': 'Start capturing text',
  },

  ja: {
    'popup.capture': 'エリアをキャプチャ',
    'popup.cancelCapture': 'キャプチャをキャンセル',
    'popup.dragToSelect': '範囲をドラッグして選択 · ESCでキャンセル',
    'popup.settings': '設定',
    'popup.historyTitle': 'クリップボード',
    'popup.clearHistory': 'クリア',
    'popup.historyEmpty': 'Cmd+Shift+S で画面のテキストをキャプチャできます',
    'popup.copied': 'コピーしました！',
    'popup.apiKeyBanner': 'Gemini APIキーを設定してください。',
    'popup.goSettings': '設定 →',

    'options.title': 'nuki 設定',
    'options.language': '言語',
    'options.apiKey': 'APIキー',
    'options.apiKeyPlaceholder': 'AIza...',
    'options.apiKeyHint': 'APIキーの取得先:',
    'options.apiKeyLink': 'Google AI Studio',
    'options.showHide': '表示/非表示',
    'options.model': 'モデル',
    'options.modelFlash25Lite': 'Gemini 2.5 Flash Lite',
    'options.modelFlash25LiteHint': '高速・無料',
    'options.modelFlash25': 'Gemini 2.5 Flash',
    'options.modelFlash25Hint': '高精度',
    'options.save': '保存',
    'options.resetDefaults': 'デフォルトに戻す',
    'options.saved': '設定を保存しました！',
    'options.resetDone': 'デフォルトに戻しました',
    'options.appearance': '外観',
    'options.theme': 'テーマ',
    'options.themeLight': 'ライト',
    'options.themeDark': 'ダーク',
    'options.themeSystem': 'システム',
    'options.tabApp': 'アプリ',
    'options.tabGemini': 'Gemini API',

    'error.noApiKey': 'APIキーが設定されていません。設定画面で入力してください。',
    'error.invalidApiKey': 'APIキーが無効です。設定画面でご確認ください — 入力ミス、無効化、または Gemini 用でないキーの可能性があります。',
    'error.emptyResponse': 'キャプチャした範囲にテキストが見つかりません。もう少し広い範囲を選択してください。',
    'error.network': 'ネットワークエラーです。接続を確認してください。',
    'error.protectedPage': 'このページはキャプチャできません。',
    'error.cropFailed': 'キャプチャ画像の処理に失敗しました。',
    'error.quotaExceeded': 'APIの使用上限に達しました。しばらく待つか、Google AI Studioでプランをご確認ください。',
    'error.rateLimited': '短時間のリクエストが多すぎます。少し待ってから再度お試しください。',
    'error.serverError': 'Gemini サーバーが一時的にご利用いただけません。しばらくしてから再度お試しください。',
    'error.blocked': 'AIのセーフティフィルターによりブロックされました。別の範囲をお試しください。',
    'error.unknown': '予期しないエラーが発生しました。',
    'error.apiError': 'APIエラー: {detail}',
    'time.now': '今',
    'time.minute': '分',
    'time.hour': '時間',
    'time.day': '日',
    'options.apiKeyInvalid': '形式が正しくありません。Google AI Studio の「AIza...」で始まるキーを貼り付けてください（余分な空白や改行が含まれていないかご確認を）。',

    'welcome.title': 'nuki',
    'welcome.subtitle': '画面の必要な部分を選択。AIがテキストを即座に抽出します。',
    'welcome.flow1': '範囲を選択',
    'welcome.flow2': 'AIがテキストを読取',
    'welcome.flow3': 'コピー完了！',
    'welcome.getStarted': 'はじめる',
    'welcome.apiTitle': 'APIキーを設定',
    'welcome.apiDesc': 'nukiはGoogle Gemini AIを使ってテキストを読み取ります。無料のAPIキーが必要です。',
    'welcome.getApiKey': 'Google AI Studioで無料APIキーを取得 \u2192',
    'welcome.skipApiKey': 'あとで設定する',
    'welcome.next': '次へ',
    'welcome.back': '戻る',
    'welcome.usageTitle': '使い方',
    'welcome.recommended': 'おすすめ',
    'welcome.shortcutTitle': 'キーボードショートカット',
    'welcome.shortcutDesc': 'どこからでもすぐにキャプチャを開始できます。',
    'welcome.panelTitle': 'サイドパネル',
    'welcome.panelDesc': 'nukiアイコンをクリックし、キャプチャボタンを押します。',
    'welcome.step1': 'テキストのある範囲をドラッグで選択',
    'welcome.step2': 'AIが自動でテキストを抽出',
    'welcome.step3': 'テキストがクリップボードにコピーされます',
    'welcome.limitTitle': 'キャプチャできないページがあります',
    'welcome.limitDesc': 'Chromeの内部ページは、ブラウザの制限により拡張機能からアクセスできません。',
    'welcome.limitTagStore': 'ウェブストア',
    'welcome.limitTagPdf': 'Chrome PDFビューア',
    'welcome.tipsTitle': '精度を上げるコツ',
    'welcome.tipsDesc': 'OCRの精度はキャプチャ対象に大きく左右されます。以下にご注意ください:',
    'welcome.tipRotated': '回転・縦書きのテキスト',
    'welcome.tipRotatedDesc': '90度回転や逆さまのテキストは正しく読み取れないことがあります。',
    'welcome.tipQuality': '画質が低い画像',
    'welcome.tipQualityDesc': 'ぼやけた画像や低解像度の素材は精度が落ちます。',
    'welcome.tipSmall': '文字が極端に小さい',
    'welcome.tipSmallDesc': 'テキストが非常に小さい場合は、先にズームしてからキャプチャしてください。',
    'welcome.tipHandwriting': '手書き・筆記体',
    'welcome.tipHandwritingDesc': '手書きや崩した筆記体のテキストは認識精度が下がります。',
    'welcome.tipContrast': '背景が複雑・コントラストが低い',
    'welcome.tipContrastDesc': '柄のある背景や背景色に近い文字は読み取れないことがあります。',
    'welcome.tipDecorative': '装飾的・アート系フォント',
    'welcome.tipDecorativeDesc': '過度に装飾されたアート系フォントや特殊な書体は誤認識の可能性があります。',
    'welcome.settingsTitle': '設定',
    'welcome.settingsDesc': '設定はいつでも変更できます。',
    'welcome.settingTheme': 'テーマ',
    'welcome.settingThemeValue': 'ライト / ダーク / システム',
    'welcome.settingLang': '言語',
    'welcome.settingLangValue': 'English / 日本語',
    'welcome.settingModel': 'AIモデル',
    'welcome.settingModelValue': 'Flash Lite（高速）/ Flash（高精度）',
    'welcome.doneTitle': '準備完了！',
    'welcome.doneDesc': 'ウェブページを開いてテキストをキャプチャしてみましょう。',
    'welcome.finish': 'テキストをキャプチャしに行く',
  },
};

const DEFAULT_LANG = 'en';
let currentLang = DEFAULT_LANG;

export function setLanguage(lang) {
  currentLang = translations[lang] ? lang : DEFAULT_LANG;
}

export function t(key, params = {}) {
  const str = translations[currentLang]?.[key] || translations[DEFAULT_LANG]?.[key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

export function applyI18n(root = document) {
  document.documentElement.lang = currentLang;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

export async function loadLanguage() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  setLanguage(settings.language || DEFAULT_LANG);
}

export async function loadTheme() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  applyTheme(settings.theme || 'system');
}

export function applyTheme(theme) {
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', isDark);
}

let _themeListener = null;

export function watchSystemTheme(theme) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (_themeListener) mq.removeEventListener('change', _themeListener);
  _themeListener = () => {
    if (theme === 'system') applyTheme('system');
  };
  mq.addEventListener('change', _themeListener);
}

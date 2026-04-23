import { t, applyI18n, setLanguage, loadLanguage, loadTheme, watchSystemTheme } from '../../utils/i18n.js';
import { ACTION } from '../../utils/actions.js';
import { isValidApiKeyFormat } from '../../utils/gemini.js';

const TOTAL_STEPS = 6;
let currentStep = 1;

document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadLanguage();
  applyI18n();

  const { settings = {} } = await chrome.storage.local.get('settings');
  watchSystemTheme(settings.theme || 'system');

  // Show platform-appropriate shortcut
  const isMac = navigator.platform.includes('Mac');
  const shortcut = isMac ? '⌘⇧S' : 'Ctrl+Shift+S';
  document.getElementById('shortcutDisplay').textContent = shortcut;
  document.getElementById('shortcutDisplayFinal').textContent = shortcut;

  // Pre-fill API key if already set
  if (settings.apiKey) {
    document.getElementById('apiKeyInput').value = settings.apiKey;
  }

  // Navigation
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', () => nextStep());
  });
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => prevStep());
  });

  // Language selection on step 1
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lang = btn.dataset.lang;
      setLanguage(lang);
      applyI18n();
      // Persist language choice
      const { settings: s = {} } = await chrome.storage.local.get('settings');
      s.language = lang;
      await chrome.storage.local.set({ settings: s });
    });
  });

  // Highlight current language
  const { settings: initSettings = {} } = await chrome.storage.local.get('settings');
  const currentLang = initSettings.language || 'en';
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  // Skip API key for later
  document.getElementById('skipApiKey').addEventListener('click', () => {
    showStep(3);
  });

  // Toggle API key visibility
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Skip tutorial — jump straight to final step so user can close
  document.getElementById('skipTutorial').addEventListener('click', () => {
    showStep(TOTAL_STEPS);
  });

  // Finish button
  document.getElementById('btnFinish').addEventListener('click', () => {
    window.close();
  });

  updateProgress();
});

async function nextStep() {
  // Save API key if entered on step 2
  if (currentStep === 2) {
    const input = document.getElementById('apiKeyInput');
    const apiKey = input.value.trim();
    if (apiKey) {
      if (!isValidApiKeyFormat(apiKey)) {
        showApiKeyError(t('options.apiKeyInvalid'));
        return;
      }
      clearApiKeyError();
      const { settings = {} } = await chrome.storage.local.get('settings');
      settings.apiKey = apiKey;
      await chrome.storage.local.set({ settings });
      chrome.runtime.sendMessage({ action: ACTION.SETTINGS_CHANGED }).catch(() => {});
    }
  }

  if (currentStep < TOTAL_STEPS) {
    showStep(currentStep + 1);
  }
}

function showApiKeyError(message) {
  const input = document.getElementById('apiKeyInput');
  input.classList.add('error');
  let err = document.getElementById('apiKeyInputError');
  if (!err) {
    err = document.createElement('p');
    err.id = 'apiKeyInputError';
    err.className = 'field-error';
    input.closest('.api-setup').appendChild(err);
  }
  err.textContent = message;
}

function clearApiKeyError() {
  document.getElementById('apiKeyInput').classList.remove('error');
  document.getElementById('apiKeyInputError')?.remove();
}

function prevStep() {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
}

function showStep(step) {
  document.querySelector(`.step[data-step="${currentStep}"]`).classList.remove('active');
  currentStep = step;
  const section = document.querySelector(`.step[data-step="${currentStep}"]`);
  section.classList.add('active');
  updateProgress();
  // Move focus to primary action for keyboard/screen-reader users
  const primary = section.querySelector('.btn-primary, .btn-next');
  if (primary) primary.focus({ preventScroll: true });
}

function updateProgress() {
  const pct = (currentStep / TOTAL_STEPS) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
}

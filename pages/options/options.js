import { t, applyI18n, loadLanguage, setLanguage, loadTheme, applyTheme, watchSystemTheme } from '../../utils/i18n.js';
import { ACTION } from '../../utils/actions.js';

const DEFAULTS = {
  apiKey: '',
  preferredModel: 'gemini-2.5-flash-lite',
  language: 'en',
  theme: 'system',
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadLanguage();
  applyI18n();
  await loadSettings();

  const { settings = {} } = await chrome.storage.local.get('settings');
  watchSystemTheme(settings.theme || 'system');
});

document.getElementById('save').addEventListener('click', saveSettings);
document.getElementById('resetDefaults').addEventListener('click', resetDefaults);
document.getElementById('toggleKey').addEventListener('click', toggleKeyVisibility);

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Live language switching
document.getElementById('language').addEventListener('change', (e) => {
  setLanguage(e.target.value);
  applyI18n();
});

// Live theme switching
document.querySelectorAll('input[name="theme"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
});


async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const merged = { ...DEFAULTS, ...settings };

  document.getElementById('apiKey').value = merged.apiKey;
  document.getElementById('language').value = merged.language;

  const modelRadios = document.querySelectorAll('input[name="model"]');
  modelRadios.forEach(r => { r.checked = r.value === merged.preferredModel; });

  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(r => { r.checked = r.value === merged.theme; });

}

async function saveSettings() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const preferredModel = document.querySelector('input[name="model"]:checked').value;
  const language = document.getElementById('language').value;
  const theme = document.querySelector('input[name="theme"]:checked').value;
  await chrome.storage.local.set({
    settings: { apiKey, preferredModel, language, theme }
  });

  chrome.runtime.sendMessage({ action: ACTION.SETTINGS_CHANGED }).catch(() => {});
  showToast(t('options.saved'));
}

async function resetDefaults() {
  await chrome.storage.local.set({ settings: { ...DEFAULTS } });
  setLanguage(DEFAULTS.language);
  applyI18n();
  await loadSettings();
  showToast(t('options.resetDone'));
}

function toggleKeyVisibility() {
  const input = document.getElementById('apiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  toast.style.animation = 'none';
  toast.offsetHeight;
  toast.style.animation = '';
  setTimeout(() => { toast.hidden = true; }, 2000);
}

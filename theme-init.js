chrome.storage.local.get('settings', ({ settings = {} }) => {
  const t = settings.theme || 'system';
  const isDark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) document.body.classList.add('dark');
});

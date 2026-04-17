// options.js
document.addEventListener('DOMContentLoaded', async () => {
  const { openaiApiKey } = await chrome.storage.sync.get('openaiApiKey');
  if (openaiApiKey) document.getElementById('apiKey').value = openaiApiKey;
});

document.getElementById('btnSave').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return;
  await chrome.storage.sync.set({ openaiApiKey: apiKey });
  const toast = document.getElementById('toast');
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2500);
});

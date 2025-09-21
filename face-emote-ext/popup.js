// popup.js
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');

startBtn.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const emotion = document.getElementById('emotion').value;
  const threshold = parseFloat(document.getElementById('threshold').value);
  const hold = parseFloat(document.getElementById('hold').value);
  const actionType = document.getElementById('actionType').value;

  const payload = { emotion, threshold, hold, actionType };

  // Inject the content script into the active tab (if not already injected)
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content_script.js']
  }).catch(() => { /* already injected maybe */ });

  // Send start message
  chrome.tabs.sendMessage(tab.id, { type: 'start-detection', payload });
  window.close();
};

stopBtn.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'stop-detection' });
  window.close();
};

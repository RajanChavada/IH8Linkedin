// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'emotion-trigger') {
    const { emotion, tabId, action } = msg.payload;

    // 1) Notification
    chrome.notifications.create({
      type: 'basic',
      title: `MoodGuard`,
      message: `Detected ${emotion}. ${action?.message || ''}`,
      priority: 2
    });

    // 2) Do actions: close tab or open YouTube
    if (action?.closeTab) {
      if (typeof tabId === 'number') {
        chrome.tabs.remove(tabId).catch(() => {});
      }
    }
    if (action?.openUrl) {
      chrome.tabs.create({ url: action.openUrl });
    }
  }
});

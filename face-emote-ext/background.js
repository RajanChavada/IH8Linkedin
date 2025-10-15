// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  // Handle emotion-trigger messages
  if (msg?.type === 'emotion-trigger') {
    const { emotion, tabId, action } = msg.payload;

    // 1) Notification
    chrome.notifications.create({
      type: 'basic',
      title: `MoodGuard`,
      message: `Detected ${emotion}. ${action?.message || ''}`,
      priority: 2
    });

  // 2) Do actions: close tab or open a specific URL
    if (action?.closeTab) {
      if (typeof tabId === 'number') {
        chrome.tabs.remove(tabId).catch(() => {});
      }
    }
    if (action?.openUrl) {
      chrome.tabs.create({ url: action.openUrl });
    }
  }

  // Handle open-brainrot-window messages
  if (msg.type === 'open-brainrot-window') {
    // Create a new window with the brainrot content
    chrome.windows.create({
      url: msg.url,
      type: 'normal',
      width: 800,
      height: 600,
      focused: true,
      left: Math.floor(Math.random() * 400), // Random position for chaos
      top: Math.floor(Math.random() * 200)
    }, (window) => {
      console.log('🐵 Brainrot window opened:', window.id);
      // Optionally, you can send a response back to the sender
      // sendResponse({ success: true, windowId: window.id });
    });

    return true; // Keep the message channel open for async response
  }
});

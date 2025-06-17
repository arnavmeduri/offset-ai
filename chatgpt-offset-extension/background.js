chrome.runtime.onInstalled.addListener((details) => {
  console.log("ChatGPT Offset Tracker installed!");
  
  // Initialize storage on first install
  if (details.reason === 'install') {
    chrome.storage.local.set({
      promptCount: 0,
      installDate: Date.now()
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateCount') {
    chrome.storage.local.set({ promptCount: request.count }, () => {
      console.log('Background: Updated prompt count to', request.count);
      sendResponse({ success: true });
    });
    return true;
  }
});

// Optional: Badge update when count changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.promptCount) {
    const count = changes.promptCount.newValue || 0;
    
    // Update badge text (optional - shows count on extension icon)
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will be handled by the popup, but we can add logic here if needed
  console.log('Extension icon clicked on tab:', tab.url);
});
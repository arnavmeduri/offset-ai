chrome.runtime.onInstalled.addListener((details) => {
  console.log("ChatGPT Offset Tracker installed!");
  
  // When installed, inject content script into existing tabs.
  // This helps if the extension is reloaded while tabs are open.
  chrome.tabs.query({ url: ["https://chat.openai.com/*", "https://chatgpt.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    }
  });

  // Initialize storage on first install
  if (details.reason === 'install') {
    chrome.storage.local.set({
      onboardingComplete: false // Keep track of onboarding
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'storeTabCount') {
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      const count = request.count;
      const storageKey = `promptCount_${tabId}`;
      
      // Store the count for the specific tab
      chrome.storage.local.set({ [storageKey]: count }, () => {
        console.log(`Background: Stored count for tab ${tabId} is ${count}`);
        
        // Update badge text for the specific tab
        if (count > 0) {
          chrome.action.setBadgeText({ text: count.toString(), tabId: tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId: tabId });
        } else {
          chrome.action.setBadgeText({ text: '', tabId: tabId });
        }
      });
      sendResponse({ success: true });
    }
    return true;
  }
});

// Clean up storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const storageKey = `promptCount_${tabId}`;
  chrome.storage.local.remove(storageKey, () => {
    console.log(`Cleaned up storage for closed tab ${tabId}`);
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will be handled by the popup, but we can add logic here if needed
  console.log('Extension icon clicked on tab:', tab.url);
});
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("ChatGPT Offset Tracker installed!");
  
  // Ensure extension ID exists first
  await ensureExtensionId();
  
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
      onboardingComplete: false,
      trackingStarted: false,
      accountLinked: false,
      linkingInitiated: false
    });
  }
});

// Improved ID generation with atomic operations
async function ensureExtensionId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['extension_user_id', 'id_generation_lock'], (result) => {
      if (result.extension_user_id) {
        resolve(result.extension_user_id);
        return;
      }
      
      // Check if another instance is generating ID
      if (result.id_generation_lock && (Date.now() - result.id_generation_lock < 5000)) {
        // Wait and retry
        setTimeout(() => ensureExtensionId().then(resolve), 100);
        return;
      }
      
      // Set lock and generate ID
      const lockTime = Date.now();
      chrome.storage.local.set({ id_generation_lock: lockTime }, () => {
        // Generate secure random ID
        const newId = crypto.randomUUID();
        chrome.storage.local.set({ 
          extension_user_id: newId,
          id_generation_lock: null,
          id_created_at: new Date().toISOString()
        }, () => {
          console.log('Generated new extension ID:', newId);
          resolve(newId);
        });
      });
    });
  });
}

// Helper to send session data to Bubble
async function sendSessionToBubble(sessionData) {
  try {
    const response = await fetch('https://offset-ai.bubbleapps.io/version-test/api/1.1/wf/create_session_log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData),
    });
    if (!response.ok) {
      console.error('Failed to log session to Bubble:', response.statusText);
    }
  } catch (err) {
    console.error('Error sending session to Bubble:', err);
  }
}

// Store session_id and start_time when a ChatGPT tab is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && (tab.url?.includes('chat.openai.com') || tab.url?.includes('chatgpt.com'))) {
    const sessionIdKey = `session_id_${tabId}`;
    const startTimeKey = `start_time_${tabId}`;
    const session_id = crypto.randomUUID();
    const start_time = new Date().toISOString();
    chrome.storage.local.set({ [sessionIdKey]: session_id, [startTimeKey]: start_time });
  }
});

// Listen for prompt count updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'storeTabCount') {
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      const count = request.count;
      const storageKey = `promptCount_${tabId}`;
      const emissionsKey = `estimated_emissions_${tabId}`;
      const waterKey = `estimated_water_${tabId}`;
      const estimated_emissions = count * 0.0002;
      const estimated_water = count * 0.5;
      chrome.storage.local.set({ [storageKey]: count, [emissionsKey]: estimated_emissions, [waterKey]: estimated_water }, () => {
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

// On tab close, log session if prompt_count > 0, then clean up
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const sessionIdKey = `session_id_${tabId}`;
  const startTimeKey = `start_time_${tabId}`;
  const promptKey = `promptCount_${tabId}`;
  const emissionsKey = `estimated_emissions_${tabId}`;
  const waterKey = `estimated_water_${tabId}`;
  chrome.storage.local.get([sessionIdKey, startTimeKey, promptKey, emissionsKey, waterKey, 'extension_user_id'], async (result) => {
    const session_id = result[sessionIdKey];
    const start_time = result[startTimeKey];
    const prompt_count = result[promptKey] || 0;
    const estimated_emissions = result[emissionsKey] || 0;
    const estimated_water = result[waterKey] || 0;
    const extension_user_id = result.extension_user_id;
    const end_time = new Date().toISOString();
    const browser_version = navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || navigator.userAgent;
    if (session_id && extension_user_id && start_time && prompt_count > 0) {
      const sessionData = {
        session_id,
        extension_user_id,
        start_time,
        end_time,
        prompt_count,
        estimated_emissions,
        estimated_water,
        browser_version
      };
      sendSessionToBubble(sessionData);
    }
    // Clean up storage
    chrome.storage.local.remove([sessionIdKey, startTimeKey, promptKey, emissionsKey, waterKey], () => {
      console.log(`Cleaned up storage for closed tab ${tabId}`);
    });
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will be handled by the popup, but we can add logic here if needed
  console.log('Extension icon clicked on tab:', tab.url);
});
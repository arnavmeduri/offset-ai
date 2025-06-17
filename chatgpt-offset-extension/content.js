// Enhanced ChatGPT Offset Tracker Content Script
let lastPromptCount = 0;
let isInitialized = false;

function countPrompts() {
  try {
    let userPrompts = [];
    
    // Strategy 1: Look for user message containers with specific ChatGPT structure
    // ChatGPT typically has messages in a conversation structure
    const messageContainers = document.querySelectorAll('[data-message-author-role="user"]');
    if (messageContainers.length > 0) {
      userPrompts = Array.from(messageContainers);
    }
    
    // Strategy 2: Look for user messages by DOM structure
    if (userPrompts.length === 0) {
      // Try to find user messages by looking for the typical ChatGPT structure
      const possibleUserMessages = document.querySelectorAll('div[class*="group"]:has(div[class*="text-token-text-primary"])');
      userPrompts = Array.from(possibleUserMessages).filter(el => {
        // Check if this is a user message by looking for indicators
        const hasUserAvatar = el.querySelector('img[alt*="user" i], img[alt*="you" i]');
        const isRightAligned = el.querySelector('div[class*="justify-end"]');
        const hasUserText = el.textContent && el.textContent.trim().length > 10;
        return (hasUserAvatar || isRightAligned) && hasUserText;
      });
    }
    
    // Strategy 3: Look for conversation turn pattern
    if (userPrompts.length === 0) {
      // Look for alternating pattern - user messages typically come before assistant responses
      const allMessages = document.querySelectorAll('div[class*="group"]');
      userPrompts = Array.from(allMessages).filter((el, index) => {
        const hasText = el.textContent && el.textContent.trim().length > 10;
        const notAssistantResponse = !el.textContent.toLowerCase().includes('chatgpt') && 
                                   !el.querySelector('[class*="assistant"]');
        return hasText && notAssistantResponse && index % 2 === 0; // Assume user messages are even-indexed
      });
    }
    
    // Strategy 4: Fallback - count input submissions
    if (userPrompts.length === 0) {
      // Try to count based on conversation history
      const conversationElements = document.querySelectorAll('div[class*="text-base"]');
      userPrompts = Array.from(conversationElements).filter(el => {
        const text = el.textContent?.trim();
        return text && text.length > 20 && !text.includes('ChatGPT') && !text.includes('Assistant');
      });
      // Take every other element assuming user/assistant alternation
      userPrompts = userPrompts.filter((_, index) => index % 2 === 0);
    }
    
    console.log("ChatGPT Offset Tracker: Found user prompts:", userPrompts.length);
    return Math.max(0, userPrompts.length);
  } catch (error) {
    console.error("ChatGPT Offset Tracker: Error counting prompts:", error);
    return lastPromptCount; // Return last known count on error
  }
}

function updatePromptCount() {
  const count = countPrompts();
  if (count !== lastPromptCount) {
    lastPromptCount = count;
    chrome.storage.local.set({ promptCount: count }, () => {
      console.log("ChatGPT Offset Tracker: Updated prompt count to:", count);
    });
  }
}

// Initialize observer for DOM changes
function initializeObserver() {
  if (isInitialized) return;
  
  const targetNode = document.querySelector('main') || 
                    document.querySelector('[role="main"]') || 
                    document.body;
  
  if (!targetNode) {
    console.log("ChatGPT Offset Tracker: Target node not found, retrying...");
    setTimeout(initializeObserver, 1000);
    return;
  }
  
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if new conversation elements were added
        const addedNodes = Array.from(mutation.addedNodes);
        if (addedNodes.some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.textContent?.length > 20 || node.querySelector('div[class*="text-base"]'))
        )) {
          shouldUpdate = true;
        }
      }
    });
    
    if (shouldUpdate) {
      // Debounce updates to avoid excessive calls
      clearTimeout(window.promptUpdateTimeout);
      window.promptUpdateTimeout = setTimeout(updatePromptCount, 500);
    }
  });
  
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  isInitialized = true;
  console.log("ChatGPT Offset Tracker: Observer initialized");
}

// Wait for page to load and initialize
function initialize() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
    return;
  }
  
  // Initial count after a short delay
  setTimeout(() => {
    updatePromptCount();
    initializeObserver();
  }, 2000);
  
  // Also check when user interacts with the page
  document.addEventListener('click', () => {
    setTimeout(updatePromptCount, 1000);
  });
  
  // Periodic check every 10 seconds
  setInterval(updatePromptCount, 10000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'resetCount') {
    lastPromptCount = 0;
    chrome.storage.local.set({ promptCount: 0 }, () => {
      console.log("ChatGPT Offset Tracker: Count reset");
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'refreshCount') {
    updatePromptCount();
    sendResponse({ count: lastPromptCount });
    return true;
  }
});

console.log("ChatGPT Offset Tracker: Content script loaded");
initialize();
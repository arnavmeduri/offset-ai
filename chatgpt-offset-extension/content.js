// Enhanced ChatGPT Offset Tracker Content Script
let lastPromptCount = 0;
let isInitialized = false;
let hasUserPrompted = false; // Tab-local flag

function isVisible(el) {
  // Checks if the element is visible in the DOM
  if (!el) return false;
  if (el.offsetParent !== null) return true;
  const style = window.getComputedStyle(el);
  return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function countPrompts() {
  try {
    let userPrompts = [];
    
    // Strategy 1: Look for user message containers with specific ChatGPT structure
    // ChatGPT typically has messages in a conversation structure
    const messageContainers = document.querySelectorAll('[data-message-author-role="user"]');
    if (messageContainers.length > 0) {
      userPrompts = Array.from(messageContainers);
      userPrompts = userPrompts.filter(el => {
        const text = el.textContent?.trim();
        const visible = isVisible(el);
        const classList = el.className || "";
        // Exclude invisible, empty, or placeholder
        if (!text || text.length === 0 || text === '...' || !visible) return false;
        // Exclude menu/system UI by class
        if (classList.includes('menu-item') || classList.includes('text-token-text-tertiary')) return false;
        // Exclude by known system phrases
        const systemPhrases = [
          'Search chats', 'Upgrade plan', 'More access to the best models',
          'Create image', 'Get advice', 'Summarize', 'Surprise me', 'window.__oai_logHTML'
        ];
        if (systemPhrases.some(phrase => text.includes(phrase))) return false;
        return true;
      });
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
      userPrompts = userPrompts.filter(el => {
        const text = el.textContent?.trim();
        const visible = isVisible(el);
        const classList = el.className || "";
        // Exclude invisible, empty, or placeholder
        if (!text || text.length === 0 || text === '...' || !visible) return false;
        // Exclude menu/system UI by class
        if (classList.includes('menu-item') || classList.includes('text-token-text-tertiary')) return false;
        // Exclude by known system phrases
        const systemPhrases = [
          'Search chats', 'Upgrade plan', 'More access to the best models',
          'Create image', 'Get advice', 'Summarize', 'Surprise me', 'window.__oai_logHTML'
        ];
        if (systemPhrases.some(phrase => text.includes(phrase))) return false;
        return true;
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
      userPrompts = userPrompts.filter(el => {
        const text = el.textContent?.trim();
        const visible = isVisible(el);
        const classList = el.className || "";
        // Exclude invisible, empty, or placeholder
        if (!text || text.length === 0 || text === '...' || !visible) return false;
        // Exclude menu/system UI by class
        if (classList.includes('menu-item') || classList.includes('text-token-text-tertiary')) return false;
        // Exclude by known system phrases
        const systemPhrases = [
          'Search chats', 'Upgrade plan', 'More access to the best models',
          'Create image', 'Get advice', 'Summarize', 'Surprise me', 'window.__oai_logHTML'
        ];
        if (systemPhrases.some(phrase => text.includes(phrase))) return false;
        return true;
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
      userPrompts = userPrompts.filter(el => {
        const text = el.textContent?.trim();
        const visible = isVisible(el);
        const classList = el.className || "";
        // Exclude invisible, empty, or placeholder
        if (!text || text.length === 0 || text === '...' || !visible) return false;
        // Exclude menu/system UI by class
        if (classList.includes('menu-item') || classList.includes('text-token-text-tertiary')) return false;
        // Exclude by known system phrases
        const systemPhrases = [
          'Search chats', 'Upgrade plan', 'More access to the best models',
          'Create image', 'Get advice', 'Summarize', 'Surprise me', 'window.__oai_logHTML'
        ];
        if (systemPhrases.some(phrase => text.includes(phrase))) return false;
        return true;
      });
    }
    
    // Debug: Log all counted prompts
    userPrompts.forEach((el, i) => console.log(`Prompt ${i}:`, el.textContent, el));
    console.log("ChatGPT Offset Tracker: Found user prompts:", userPrompts.length);
    
    if (!hasUserPrompted) {
      if (userPrompts.length > 0) {
        hasUserPrompted = true;
      } else {
        return 0; // Return 0 until the first prompt
      }
    }
    
    return Math.max(0, userPrompts.length);
  } catch (error) {
    console.error("ChatGPT Offset Tracker: Error counting prompts:", error);
    return lastPromptCount;
  }
}

function updatePromptCount() {
  const count = countPrompts();
  if (count !== lastPromptCount) {
    lastPromptCount = count;
    // Notify background to store the count for this tab
    try {
      chrome.runtime.sendMessage({ action: 'storeTabCount', count: count });
    } catch (e) {
      // This error is expected if the extension is reloaded.
      // We can safely ignore it, as the new content script will take over.
      console.warn("Could not contact background script. Extension may have been reloaded.");
    }
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
  // Always run these, regardless of document.readyState
  setTimeout(() => {
    updatePromptCount();
    initializeObserver();
  }, 2000);
  document.addEventListener('click', () => {
    setTimeout(updatePromptCount, 1000);
  });
  setInterval(updatePromptCount, 10000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
  if (request.action === 'resetCount') {
    lastPromptCount = 0;
    hasUserPrompted = false;
    updatePromptCount(); // This will now send a count of 0 to the background
    console.log("ChatGPT Offset Tracker: Count reset for this tab");
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'refreshCount') {
    updatePromptCount();
    sendResponse({ count: lastPromptCount });
    return true;
  }
});

console.log("ChatGPT Offset Tracker: Content script loaded");
initialize();
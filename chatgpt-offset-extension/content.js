
// Improved: Watches chat history, counts user prompts, stores result with better selector.

function countPrompts() {
  // Attempt to select all user message containers.
  // ChatGPT user prompts typically have role="user" or aria-label, but fallback as needed.
  // We'll try a few common strategies.
  // Option 1: Look for divs with 'text-base' but also specific user roles or alignment.
  // Option 2: Find message elements that are marked with data attributes or ancestor/descendant with user info.

  // Try to find user message bubbles:
  let userPrompts = [];
  // Strategy 1: Modern ChatGPT usually has .text-base (for all messages) AND left-aligns user prompts.
  userPrompts = Array.from(document.querySelectorAll('.text-base.justify-end'));

  // Strategy 2: Fallback - try to find elements authored by user using data attributes
  if (userPrompts.length === 0) {
    // Older ChatGPT DOMs placed user messages with .text-base and a data-testid/user attribute
    userPrompts = Array.from(document.querySelectorAll('.text-base[data-testid="user-message"]'));
  }

  // Strategy 3: If still nothing, fallback to anything with .text-base as last resort
  if (userPrompts.length === 0) {
    userPrompts = Array.from(document.querySelectorAll('.text-base'));
  }

  // Final filter to avoid empty bubbles, etc.
  userPrompts = userPrompts.filter(el => el.textContent && el.textContent.trim().length > 0);

  // For debugging, show how many found
  console.log("ChatGPT Offset Tracker: counted user prompts", userPrompts.length);
  return userPrompts.length;
}

// Observe mutations in chat area (main content container)
const chatRoot = document.querySelector('main') || document.body;

const observer = new MutationObserver(() => {
  const count = countPrompts();
  chrome.storage.local.set({ promptCount: count });
});

if (chatRoot) {
  observer.observe(chatRoot, { childList: true, subtree: true });
}

// On initial load wait and set count
setTimeout(() => {
  chrome.storage.local.set({ promptCount: countPrompts() });
}, 1000);

console.log("ChatGPT Offset Tracker: content script loaded. Observing for user prompts.");


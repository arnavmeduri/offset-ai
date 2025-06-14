
// Watches conversation history, counts user prompts, stores result.

function countPrompts() {
  // Simple selector for prompt bubbles sent by user (may need adjustment)
  const userPrompts = Array.from(document.querySelectorAll('.text-base')).filter(el => el.textContent.trim().length > 0);
  return userPrompts.length;
}

// Observe chat for new prompts sent
const observer = new MutationObserver(() => {
  const count = countPrompts();
  chrome.storage.local.set({ promptCount: count });
});

// Start observing main chat area
const chatArea = document.body;
if (chatArea) {
  observer.observe(chatArea, { childList: true, subtree: true });
}

// Initialize count
setTimeout(() => {
  chrome.storage.local.set({ promptCount: countPrompts() });
}, 2000);

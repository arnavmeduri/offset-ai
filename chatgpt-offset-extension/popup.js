// Estimate factors
const CO2_PER_PROMPT = 0.0002;   // kg CO₂e per prompt (0.2g)
const WATER_PER_PROMPT = 0.5;    // liters per prompt

let intervalId;
let isUpdating = false;

function formatNumber(num, decimals = 2) {
  if (num === 0) return '0';
  if (num < 0.001) return '< 0.001';
  return num.toFixed(decimals);
}

function updateDisplay() {
  if (isUpdating) return;
  isUpdating = true;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) {
      isUpdating = false;
      return;
    }
    const tabId = tabs[0].id;
    const storageKey = `promptCount_${tabId}`;
    
    chrome.storage.local.get([storageKey], (result) => {
      const promptCount = result[storageKey] || 0;
      const emissions = promptCount * CO2_PER_PROMPT;
      const water = promptCount * WATER_PER_PROMPT;

      document.getElementById('impactDisplay').innerHTML = `
        <span title="Number of prompts sent to ChatGPT">
          <span class="metric-icon" style="display: flex; align-items: center;">
            <img src="assets/message_circle.png" alt="Prompts" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" />
          </span>
          <strong>Prompts:</strong> ${promptCount}
        </span>
        <span title="Estimated CO₂ emissions from AI processing">
          <span class="metric-icon" style="display: flex; align-items: center;">
            <img src="assets/wind.png" alt="Emissions" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" />
          </span>
          <strong>Emissions:</strong> ${formatNumber(emissions, 4)} kg CO₂e
        </span>
        <span title="Estimated water used for data center cooling">
          <span class="metric-icon" style="display: flex; align-items: center;">
            <img src="assets/droplet.png" alt="Water" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;" />
          </span>
          <strong>Water:</strong> ${formatNumber(water, 1)} L
        </span>
      `;
      
      // Update button text based on impact
      const offsetBtn = document.getElementById('offsetBtn');
      if (promptCount > 0) {
        offsetBtn.innerHTML = `
          Offset ${formatNumber(emissions, 3)} kg CO₂e
        `;
        offsetBtn.disabled = false;
      } else {
        offsetBtn.innerHTML = `
          Offset My Impact
        `;
        offsetBtn.disabled = true;
      }
      
      isUpdating = false;
    });
  });
}

function resetCount() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
    const activeTab = tabs[0];
    
    if (activeTab.url?.includes('chat.openai.com') || activeTab.url?.includes('chatgpt.com')) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'resetCount' }, (response) => {
        if (chrome.runtime.lastError) { /* ignore */ }
        if (response?.success) {
          updateDisplay(); // Refresh display after reset
          showToast('Count for this session has been reset!');
        }
      });
    }
  });
}

function refreshCount() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab.url?.includes('chat.openai.com')) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'refreshCount' }, (response) => {
        updateDisplay();
        showToast('Count refreshed!');
      });
    } else {
      updateDisplay();
      showToast('Count refreshed! (Visit ChatGPT for live tracking)');
    }
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 2000);
}

function openOffsetPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
    const tabId = tabs[0].id;
    const storageKey = `promptCount_${tabId}`;
    chrome.storage.local.get([storageKey], (result) => {
      const promptCount = result[storageKey] || 0;
      if (promptCount > 0) {
        const emissions = promptCount * CO2_PER_PROMPT;
        // You can customize this URL to include the emissions data
        const offsetUrl = `https://www.pachama.com/marketplace?emissions=${emissions.toFixed(4)}`;
        window.open(offsetUrl, "_blank");
      } else {
        window.open("https://www.pachama.com/marketplace", "_blank");
      }
    });
  });
}

function showWelcomePage() {
  document.getElementById('welcomePage').style.display = 'block';
  document.getElementById('mainPage').style.display = 'none';
}

function showMainPage() {
  document.getElementById('welcomePage').style.display = 'none';
  document.getElementById('mainPage').style.display = 'block';
}

function checkChatgptTab(callback) {
  chrome.tabs.query({
    url: ["https://chat.openai.com/*", "https://chatgpt.com/*"]
  }, function(tabs) {
    callback(tabs.length > 0);
  });
}

function updateWelcomeSessionMsg() {
  checkChatgptTab((isChatgptOpen) => {
    const msgDiv = document.getElementById('noSessionMsg');
    if (!msgDiv) return;
    if (!isChatgptOpen) {
      msgDiv.style.display = 'block';
      const openLink = document.getElementById('openChatgptLink');
      if (openLink) {
        openLink.onclick = (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: 'https://chat.openai.com/' });
        };
      }
    } else {
      msgDiv.style.display = 'none';
    }
  });
}

function checkContentScriptRunning(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs.length || !tabs[0].id || !(tabs[0].url?.includes('chat.openai.com') || tabs[0].url?.includes('chatgpt.com'))) {
      // If not on a ChatGPT tab, we assume it's "running" to not show the error.
      callback(true);
      return;
    }
    const activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        // No listener, so content script isn't running
        callback(false);
        return;
      }
      callback(response && response.pong);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['onboardingComplete'], ({ onboardingComplete }) => {
    if (onboardingComplete) {
      checkChatgptTab((isChatgptOpen) => {
        if (isChatgptOpen) {
          document.getElementById('welcomePage').style.display = 'none';
          document.getElementById('mainPage').style.display = 'block';
          // Initial display update
          updateDisplay();
          // Set up event listeners
          document.getElementById('offsetBtn').addEventListener('click', openOffsetPage);
          document.getElementById('resetBtn').addEventListener('click', resetCount);
          document.getElementById('refreshBtn').addEventListener('click', refreshCount);
          // Auto-refresh every 3 seconds while popup is open
          intervalId = setInterval(updateDisplay, 3000);
          checkContentScriptRunning((isRunning) => {
            const msgDiv = document.getElementById('noContentScriptMsg');
            if (msgDiv) msgDiv.style.display = isRunning ? 'none' : 'block';
          });
        } else {
          document.getElementById('mainPage').style.display = 'none';
          document.getElementById('welcomePage').style.display = 'block';
          const msgDiv = document.getElementById('noSessionMsg');
          if (msgDiv) msgDiv.style.display = 'block';
          const openLink = document.getElementById('openChatgptLink');
          if (openLink) {
            openLink.onclick = (e) => {
              e.preventDefault();
              chrome.tabs.create({ url: 'https://chat.openai.com/' });
            };
          }
        }
      });
    } else {
      showWelcomePage();
      document.getElementById('getStartedBtn').addEventListener('click', () => {
        chrome.storage.local.set({ onboardingComplete: true }, () => {
          checkChatgptTab((isChatgptOpen) => {
            if (isChatgptOpen) {
              document.getElementById('welcomePage').style.display = 'none';
              document.getElementById('mainPage').style.display = 'block';
              // Initial display update
              updateDisplay();
              // Set up event listeners
              document.getElementById('offsetBtn').addEventListener('click', openOffsetPage);
              document.getElementById('resetBtn').addEventListener('click', resetCount);
              document.getElementById('refreshBtn').addEventListener('click', refreshCount);
              // Auto-refresh every 3 seconds while popup is open
              intervalId = setInterval(updateDisplay, 3000);
              checkContentScriptRunning((isRunning) => {
                const msgDiv = document.getElementById('noContentScriptMsg');
                if (msgDiv) msgDiv.style.display = isRunning ? 'none' : 'block';
              });
            } else {
              document.getElementById('mainPage').style.display = 'none';
              document.getElementById('welcomePage').style.display = 'block';
              const msgDiv = document.getElementById('noSessionMsg');
              if (msgDiv) msgDiv.style.display = 'block';
              const openLink = document.getElementById('openChatgptLink');
              if (openLink) {
                openLink.onclick = (e) => {
                  e.preventDefault();
                  chrome.tabs.create({ url: 'https://chat.openai.com/' });
                };
              }
            }
          });
        });
      });
    }
  });
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => window.close());
  }
});

// Cleanup when popup closes
window.addEventListener('beforeunload', () => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  } else {
    if (!intervalId) {
      updateDisplay();
      intervalId = setInterval(updateDisplay, 3000);
    }
  }
});
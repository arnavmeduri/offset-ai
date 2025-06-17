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
  
  chrome.storage.local.get(['promptCount'], ({ promptCount = 0 }) => {
    const emissions = promptCount * CO2_PER_PROMPT;
    const water = promptCount * WATER_PER_PROMPT;

    document.getElementById('impactDisplay').innerHTML = `
      <span title="Number of prompts sent to ChatGPT">
        <span class="metric-icon">🗨️</span>
        <strong>Prompts:</strong> ${promptCount}
      </span>
      <span title="Estimated CO₂ emissions from AI processing">
        <span class="metric-icon">🌍</span>
        <strong>Emissions:</strong> ${formatNumber(emissions, 4)} kg CO₂e
      </span>
      <span title="Estimated water used for data center cooling">
        <span class="metric-icon">💧</span>
        <strong>Water:</strong> ${formatNumber(water, 1)} L
      </span>
    `;
    
    // Update button text based on impact
    const offsetBtn = document.getElementById('offsetBtn');
    if (promptCount > 0) {
      offsetBtn.innerHTML = `
        <span class="btn-icon">💚</span>
        Offset ${formatNumber(emissions, 3)} kg CO₂e
      `;
      offsetBtn.disabled = false;
    } else {
      offsetBtn.innerHTML = `
        <span class="btn-icon">💚</span>
        Offset My Impact
      `;
      offsetBtn.disabled = true;
    }
    
    isUpdating = false;
  });
}

function resetCount() {
  if (confirm('Reset your prompt count? This will clear all tracked usage.')) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab.url?.includes('chat.openai.com')) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'resetCount' }, (response) => {
          if (response?.success) {
            updateDisplay();
            showToast('Count reset successfully!');
          } else {
            // Fallback: reset storage directly
            chrome.storage.local.set({ promptCount: 0 }, () => {
              updateDisplay();
              showToast('Count reset successfully!');
            });
          }
        });
      } else {
        // Reset storage directly if not on ChatGPT
        chrome.storage.local.set({ promptCount: 0 }, () => {
          updateDisplay();
          showToast('Count reset successfully!');
        });
      }
    });
  }
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
  chrome.storage.local.get(['promptCount'], ({ promptCount = 0 }) => {
    if (promptCount > 0) {
      const emissions = promptCount * CO2_PER_PROMPT;
      // You can customize this URL to include the emissions data
      const offsetUrl = `https://www.pachama.com/marketplace?emissions=${emissions.toFixed(4)}`;
      window.open(offsetUrl, "_blank");
    } else {
      window.open("https://www.pachama.com/marketplace", "_blank");
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Initial display update
  updateDisplay();

  // Set up event listeners
  document.getElementById('offsetBtn').addEventListener('click', openOffsetPage);
  document.getElementById('resetBtn').addEventListener('click', resetCount);
  document.getElementById('refreshBtn').addEventListener('click', refreshCount);

  // Auto-refresh every 3 seconds while popup is open
  intervalId = setInterval(updateDisplay, 3000);
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
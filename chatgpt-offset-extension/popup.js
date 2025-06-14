// Estimate factors
const CO2_PER_PROMPT = 0.0002;   // kg CO₂e per prompt (example: 0.2g)
const WATER_PER_PROMPT = 0.5;    // liters per prompt (as water for cooling)

function updateDisplay() {
  chrome.storage.local.get(['promptCount'], ({ promptCount = 0 }) => {
    const emissions = promptCount * CO2_PER_PROMPT;
    const water = promptCount * WATER_PER_PROMPT;

    document.getElementById('impactDisplay').innerHTML = `
      <span title="Number of prompts sent">🗨️ <strong>Prompts:</strong> ${promptCount}</span>
      <span title="Estimated CO₂ emissions">🌍 <strong>Emissions:</strong> ${emissions.toFixed(4)} kg CO₂e</span>
      <span title="Estimated cumulative water used for cooling">💧 <strong>Water Use:</strong> ${water.toFixed(1)} L</span>
    `;
  });
}

let intervalId;
let hasAccount = false;

function showActionButton() {
  const btn = document.getElementById('offsetBtn');
  if (!btn) return;

  if (hasAccount) {
    btn.innerHTML = '<span class="btn-icon">Go to Dashboard</span>';
    btn.onclick = () => {
      window.open("https://app.offset-ai.com", "_blank");
    };
  } else {
    btn.innerHTML = '<span class="btn-icon">💚</span>Offset My Impact';
    btn.onclick = () => {
      window.open("https://www.pachama.com/marketplace", "_blank");
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Determine login state (for demo: chrome.storage.local.get 'hasAccount')
  chrome.storage.local.get(['hasAccount'], (result) => {
    hasAccount = !!result.hasAccount;
    showActionButton();
  });

  updateDisplay();
  intervalId = setInterval(updateDisplay, 2000);
});

// Update the action button if login state changes while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'hasAccount' in changes) {
    hasAccount = !!changes.hasAccount.newValue;
    showActionButton();
  }
});

// Clear interval when popup closes (defensive: Chrome often destroys popup)
window.addEventListener('unload', () => {
  if (intervalId) clearInterval(intervalId);
});

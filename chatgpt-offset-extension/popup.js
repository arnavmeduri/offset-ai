
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

document.addEventListener('DOMContentLoaded', () => {
  updateDisplay();

  // Refresh every 2 seconds while popup open, to catch changes
  intervalId = setInterval(updateDisplay, 2000);

  document.getElementById('offsetBtn').onclick = () => {
    window.open("https://www.pachama.com/marketplace", "_blank");
  };
});

// Clear interval when popup closes (defensive: Chrome often destroys popup)
window.addEventListener('unload', () => {
  if (intervalId) clearInterval(intervalId);
});

// Clear interval when popup closes (defensive: Chrome often destroys popup)
window.addEventListener('unload', () => {
  if (intervalId) clearInterval(intervalId);
});

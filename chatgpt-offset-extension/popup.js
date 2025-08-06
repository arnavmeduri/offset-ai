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
    } else {
      msgDiv.style.display = 'none';
    }
  });
}

function updateGetStartedButton() {
  const getStartedBtn = document.getElementById('getStartedBtn');
  if (!getStartedBtn) return;
  
  checkChatgptTab((isChatgptOpen) => {
    if (isChatgptOpen) {
      getStartedBtn.disabled = false;
      getStartedBtn.style.background = '#182827';
      getStartedBtn.style.color = '#BEEA8C';
      getStartedBtn.style.cursor = 'pointer';
    } else {
      getStartedBtn.disabled = true;
      getStartedBtn.style.background = '#cbd5e1';
      getStartedBtn.style.color = '#94a3b8';
      getStartedBtn.style.cursor = 'not-allowed';
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
      showToast('Failed to log session to Bubble');
    } else {
      showToast('Session log sent!');
    }
  } catch (err) {
    showToast('Error sending session to Bubble');
  }
}

function showAccountConnectedMessage() {
  const accountConnectedMsg = document.getElementById('accountConnectedMsg');
  if (accountConnectedMsg) {
    accountConnectedMsg.style.display = 'flex';
    // Hide after 3 seconds
    setTimeout(() => {
      accountConnectedMsg.style.display = 'none';
    }, 3000);
  }
}

async function handleConnectAccount() {
  chrome.storage.local.get(['extension_user_id'], async (result) => {
    const extension_user_id = result.extension_user_id;
    if (!extension_user_id) {
      console.error("No extension_user_id found in storage.");
      showToast("Unable to find your extension ID. Please try reloading the extension.");
      return;
    }
    
    try {
      // Send POST request to Bubble backend
      const response = await fetch('https://offset-ai.bubbleapps.io/version-test/api/1.1/wf/initiate_linking_process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ extension_user_id }),
      });
      
      if (!response.ok) {
        console.error('Failed to initiate linking:', response.statusText);
        showToast("Failed to link account. Please try again.");
        return;
      }
      
      // Get response to confirm backend received the ID
      const responseData = await response.json();
      if (responseData.success) {
        // CRITICAL FIX: Pass extension ID to dashboard via URL parameter
        const dashboardUrl = `https://dashboard.offsetai.app/version-test/sign-up?m=Signup&extension_id=${encodeURIComponent(extension_user_id)}`;
        chrome.tabs.create({ url: dashboardUrl });
        
        // Mark linking as initiated
        chrome.storage.local.set({ 
          linkingInitiated: true, 
          linkingTimestamp: Date.now() 
        });
        
        showAccountConnectedMessage();
        
        // Start checking for successful linking
        startLinkingVerification();
      } else {
        showToast("Backend failed to process linking request.");
      }
    } catch (err) {
      console.error('Error sending extension_user_id to backend:', err);
      showToast("Network error. Please check your connection and try again.");
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Use new onboarding state management
  await updateOnboardingUI();
  
  // Set up periodic UI updates for welcome page
  setInterval(async () => {
    const state = await getOnboardingState();
    if (state === OnboardingStates.WELCOME) {
      updateWelcomeSessionMsg();
      updateGetStartedButton();
    }
  }, 1000);

  // Close button handler
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => window.close());
  }

  // Connect Account button handler
  const connectAccountBtn = document.getElementById('connectAccountBtn');
  if (connectAccountBtn) {
    connectAccountBtn.addEventListener('click', handleConnectAccount);
  }

  // Get Started button handler
  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      checkChatgptTab((isChatgptOpen) => {
        if (isChatgptOpen) {
          chrome.storage.local.set({ onboardingComplete: true, trackingStarted: true }, () => {
            showMainPage();
            updateDisplay();
            
            checkContentScriptRunning((isRunning) => {
              const msgDiv = document.getElementById('noContentScriptMsg');
              if (msgDiv) msgDiv.style.display = isRunning ? 'none' : 'block';
            });
          });
        }
      });
    });
  }

  // Force Log button handler
  const forceLogBtn = document.getElementById('forceLogBtn');
  if (forceLogBtn) {
    forceLogBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length || !tabs[0].id) return;
        const tabId = tabs[0].id;
        const sessionIdKey = `session_id_${tabId}`;
        const startTimeKey = `start_time_${tabId}`;
        const promptKey = `promptCount_${tabId}`;
        const emissionsKey = `estimated_emissions_${tabId}`;
        const waterKey = `estimated_water_${tabId}`;
        
        chrome.storage.local.get([sessionIdKey, startTimeKey, promptKey, emissionsKey, waterKey, 'extension_user_id'], (result) => {
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
          } else {
            showToast('No session data to log');
          }
        });
      });
    });
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

// Add account linking verification
async function verifyAccountLinking() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['extension_user_id'], async (result) => {
      const extension_user_id = result.extension_user_id;
      if (!extension_user_id) {
        resolve(false);
        return;
      }
      
      try {
        const response = await fetch('https://offset-ai.bubbleapps.io/version-test/api/1.1/wf/check_linking_status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ extension_user_id }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.linked) {
            chrome.storage.local.set({ 
              accountLinked: true,
              linkedAt: new Date().toISOString(),
              userAccountId: data.user_account_id 
            });
            resolve(true);
            return;
          }
        }
      } catch (err) {
        console.error('Error verifying account linking:', err);
      }
      resolve(false);
    });
  });
}

function startLinkingVerification() {
  const checkInterval = setInterval(async () => {
    const isLinked = await verifyAccountLinking();
    if (isLinked) {
      clearInterval(checkInterval);
      showToast('Account successfully linked!');
      updateOnboardingUI();
    }
  }, 5000); // Check every 5 seconds
  
  // Stop checking after 5 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 5 * 60 * 1000);
}

// Enhanced onboarding state management
const OnboardingStates = {
  WELCOME: 'welcome',
  LINKING_ACCOUNT: 'linking_account',
  WAITING_FOR_SIGNUP: 'waiting_for_signup',
  ACCOUNT_LINKED: 'account_linked',
  TRACKING_ACTIVE: 'tracking_active'
};

async function getOnboardingState() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'onboardingComplete', 
      'trackingStarted', 
      'linkingInitiated', 
      'accountLinked'
    ], (result) => {
      if (result.trackingStarted && result.accountLinked) {
        resolve(OnboardingStates.TRACKING_ACTIVE);
      } else if (result.accountLinked) {
        resolve(OnboardingStates.ACCOUNT_LINKED);
      } else if (result.linkingInitiated) {
        resolve(OnboardingStates.WAITING_FOR_SIGNUP);
      } else {
        resolve(OnboardingStates.WELCOME);
      }
    });
  });
}

async function updateOnboardingUI() {
  const state = await getOnboardingState();
  
  switch (state) {
    case OnboardingStates.WELCOME:
      showWelcomePage();
      break;
      
    case OnboardingStates.WAITING_FOR_SIGNUP:
      showWaitingForSignupPage();
      break;
      
    case OnboardingStates.ACCOUNT_LINKED:
      showAccountLinkedPage();
      break;
      
    case OnboardingStates.TRACKING_ACTIVE:
      showMainPage();
      updateDisplay();
      break;
  }
}

function showWaitingForSignupPage() {
  document.getElementById('welcomePage').innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <img src="assets/offset_ai_logo.png" alt="OffsetAI Logo" style="width: 54px; height: 54px; margin-bottom: 18px;" />
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; color: #1e293b;">Complete Your Signup</h2>
      <p style="font-size: 0.95rem; color: #334155; margin-bottom: 18px;">Please complete your account creation in the dashboard tab that opened.</p>
      <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 18px;">⏳ Waiting for account creation...</div>
      <button id="retryLinkingBtn" class="connect-btn" style="width: 100%; max-width: 240px;">Retry Linking</button>
    </div>
  `;
  
  document.getElementById('retryLinkingBtn').addEventListener('click', handleConnectAccount);
}

function showAccountLinkedPage() {
  document.getElementById('welcomePage').innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <img src="assets/offset_ai_logo.png" alt="OffsetAI Logo" style="width: 54px; height: 54px; margin-bottom: 18px;" />
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; color: #1e293b;">Account Linked Successfully! ✅</h2>
      <p style="font-size: 0.95rem; color: #334155; margin-bottom: 18px;">Your extension is now connected to your dashboard account.</p>
      <button id="startTrackingBtn" class="get-started-btn" style="width: 100%; max-width: 240px;">Start Tracking</button>
    </div>
  `;
  
  document.getElementById('startTrackingBtn').addEventListener('click', () => {
    chrome.storage.local.set({ trackingStarted: true }, () => {
      showMainPage();
      updateDisplay();
    });
  });
}
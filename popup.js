
// Popup script for the extension

// DOM elements
const enabledSwitch = document.getElementById('enabledSwitch');
const statusText = document.getElementById('statusText');
const saveSettingsBtn = document.getElementById('saveSettings');
const connectionStatus = document.getElementById('connectionStatus');

// Input elements
const accountSizeInput = document.getElementById('accountSize');
const riskPerTradeInput = document.getElementById('riskPerTrade');
const lotSizePerTradeInput = document.getElementById('lotSizePerTrade');
const shortMAPeriodInput = document.getElementById('shortMAPeriod');
const longMAPeriodInput = document.getElementById('longMAPeriod');
const emaPeriodInput = document.getElementById('emaPeriod');
const atrLengthInput = document.getElementById('atrLength');
const cooldownPeriodInput = document.getElementById('cooldownPeriod');

// Initialize popup with current state and settings
function initializePopup() {
  // Get current state and settings from storage
  chrome.storage.local.get(['isEnabled', 'settings'], (result) => {
    // Set enabled state
    if (result.isEnabled) {
      enabledSwitch.checked = true;
      statusText.textContent = 'Enabled';
      statusText.className = 'enabled';
    } else {
      enabledSwitch.checked = false;
      statusText.textContent = 'Disabled';
      statusText.className = 'disabled';
    }
    
    // Set settings values if they exist
    if (result.settings) {
      accountSizeInput.value = result.settings.accountSize;
      riskPerTradeInput.value = result.settings.riskPerTrade;
      lotSizePerTradeInput.value = result.settings.lotSizePerTrade;
      shortMAPeriodInput.value = result.settings.shortMAPeriod;
      longMAPeriodInput.value = result.settings.longMAPeriod;
      emaPeriodInput.value = result.settings.emaPeriod;
      atrLengthInput.value = result.settings.atrLength;
      cooldownPeriodInput.value = result.settings.cooldownPeriod;
    }
  });
  
  // Check MT5 connection status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const currentTab = tabs[0];
      const isMT5 = 
        currentTab.url.includes('metatrader5') || 
        currentTab.url.includes('mql5') ||
        currentTab.url.includes('metaquotes');
      
      if (isMT5) {
        connectionStatus.textContent = 'Connected to MT5';
        connectionStatus.className = 'connected';
      } else {
        connectionStatus.textContent = 'Not connected to MT5';
        connectionStatus.className = 'disconnected';
      }
    }
  });
}

// Toggle enabled state
enabledSwitch.addEventListener('change', () => {
  const isEnabled = enabledSwitch.checked;
  
  // Update UI
  if (isEnabled) {
    statusText.textContent = 'Enabled';
    statusText.className = 'enabled';
  } else {
    statusText.textContent = 'Disabled';
    statusText.className = 'disabled';
  }
  
  // Send message to background script
  chrome.runtime.sendMessage({ 
    action: 'toggleEnabled', 
    value: isEnabled 
  }, (response) => {
    console.log('Toggled enabled state:', response);
  });
});

// Save settings
saveSettingsBtn.addEventListener('click', () => {
  // Validate inputs
  if (!validateInputs()) {
    return;
  }
  
  // Create settings object from inputs
  const settings = {
    accountSize: parseInt(accountSizeInput.value),
    riskPerTrade: parseInt(riskPerTradeInput.value),
    lotSizePerTrade: parseFloat(lotSizePerTradeInput.value),
    shortMAPeriod: parseInt(shortMAPeriodInput.value),
    longMAPeriod: parseInt(longMAPeriodInput.value),
    emaPeriod: parseInt(emaPeriodInput.value),
    atrLength: parseInt(atrLengthInput.value),
    cooldownPeriod: parseInt(cooldownPeriodInput.value)
  };
  
  // Send message to background script
  chrome.runtime.sendMessage({ 
    action: 'saveSettings', 
    settings: settings 
  }, (response) => {
    if (response.success) {
      const saveBtn = document.getElementById('saveSettings');
      const originalText = saveBtn.textContent;
      
      // Show saved confirmation
      saveBtn.textContent = 'Settings Saved!';
      saveBtn.style.backgroundColor = '#4CAF50';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.backgroundColor = '#2196F3';
      }, 2000);
    }
  });
});

// Validate all input fields
function validateInputs() {
  // Validate account size
  if (accountSizeInput.value < 1) {
    alert('Account size must be at least 1 USD');
    accountSizeInput.focus();
    return false;
  }
  
  // Validate risk per trade
  if (riskPerTradeInput.value < 1) {
    alert('Risk per trade must be at least 1 USD');
    riskPerTradeInput.focus();
    return false;
  }
  
  // Validate lot size
  if (lotSizePerTradeInput.value < 0.01) {
    alert('Lot size must be at least 0.01');
    lotSizePerTradeInput.focus();
    return false;
  }
  
  // Validate short MA period
  if (shortMAPeriodInput.value < 1) {
    alert('Short MA period must be at least 1');
    shortMAPeriodInput.focus();
    return false;
  }
  
  // Validate long MA period
  if (longMAPeriodInput.value < 1) {
    alert('Long MA period must be at least 1');
    longMAPeriodInput.focus();
    return false;
  }
  
  // Validate that short MA is less than long MA
  if (parseInt(shortMAPeriodInput.value) >= parseInt(longMAPeriodInput.value)) {
    alert('Short MA period must be less than Long MA period');
    shortMAPeriodInput.focus();
    return false;
  }
  
  // Validate EMA period
  if (emaPeriodInput.value < 1) {
    alert('EMA period must be at least 1');
    emaPeriodInput.focus();
    return false;
  }
  
  // Validate ATR length
  if (atrLengthInput.value < 1) {
    alert('ATR length must be at least 1');
    atrLengthInput.focus();
    return false;
  }
  
  // Validate cooldown period
  if (cooldownPeriodInput.value < 1) {
    alert('Cooldown period must be at least 1 minute');
    cooldownPeriodInput.focus();
    return false;
  }
  
  return true;
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);

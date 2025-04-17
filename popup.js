
// Popup script for the extension

// DOM elements
const enabledSwitch = document.getElementById('enabledSwitch');
const statusText = document.getElementById('statusText');
const saveSettingsBtn = document.getElementById('saveSettings');
const connectionStatus = document.getElementById('connectionStatus');
const connectionIcon = document.getElementById('connectionIcon');

// Trade statistics elements
const totalTradesElement = document.getElementById('totalTrades');
const winRateElement = document.getElementById('winRate');
const profitLossElement = document.getElementById('profitLoss');
const successfulTradesElement = document.getElementById('successfulTrades');
const failedTradesElement = document.getElementById('failedTrades');
const pairStatsContainer = document.getElementById('pairStatsContainer');

// Input elements
const accountSizeInput = document.getElementById('accountSize');
const riskPerTradeInput = document.getElementById('riskPerTrade');
const lotSizePerTradeInput = document.getElementById('lotSizePerTrade');
const tradingPairsInput = document.getElementById('tradingPairs');
const shortMAPeriodInput = document.getElementById('shortMAPeriod');
const longMAPeriodInput = document.getElementById('longMAPeriod');
const emaPeriodInput = document.getElementById('emaPeriod');
const atrLengthInput = document.getElementById('atrLength');
const cooldownPeriodInput = document.getElementById('cooldownPeriod');
const enablePyramidingInput = document.getElementById('enablePyramiding');
const maxPyramidPositionsInput = document.getElementById('maxPyramidPositions');

// Server URL
const serverUrl = "http://localhost:5555";

// Initialize popup with current state and settings
function initializePopup() {
  // Get current state and settings from storage
  chrome.storage.local.get(['isEnabled', 'settings', 'tradeStatistics'], (result) => {
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
      
      if (result.settings.tradingPairs) {
        tradingPairsInput.value = Array.isArray(result.settings.tradingPairs) 
          ? result.settings.tradingPairs.join(',') 
          : result.settings.tradingPairs;
      }
      
      shortMAPeriodInput.value = result.settings.shortMAPeriod;
      longMAPeriodInput.value = result.settings.longMAPeriod;
      emaPeriodInput.value = result.settings.emaPeriod;
      atrLengthInput.value = result.settings.atrLength;
      cooldownPeriodInput.value = result.settings.cooldownPeriod;
      
      // Set advanced options if they exist
      if (result.settings.enablePyramiding !== undefined) {
        enablePyramidingInput.checked = result.settings.enablePyramiding;
      }
      
      if (result.settings.maxPyramidPositions !== undefined) {
        maxPyramidPositionsInput.value = result.settings.maxPyramidPositions;
      }
    }
    
    // Update trade statistics
    if (result.tradeStatistics) {
      updateStatisticsUI(result.tradeStatistics);
    }
  });
  
  // Check MT5 connection status directly with the server
  checkConnectionStatus();
}

// Update statistics UI with the provided data
function updateStatisticsUI(statistics) {
  // Update main statistics
  totalTradesElement.textContent = statistics.totalTrades;
  winRateElement.textContent = statistics.winRate.toFixed(1) + '%';
  
  const profitLossValue = statistics.profitLoss.toFixed(2);
  profitLossElement.textContent = '$' + Math.abs(profitLossValue);
  profitLossElement.className = 'stat-value ' + (statistics.profitLoss >= 0 ? 'profit' : 'loss');
  
  successfulTradesElement.textContent = statistics.successfulTrades;
  failedTradesElement.textContent = statistics.failedTrades;
  
  // Update pair statistics
  if (Object.keys(statistics.tradingPairs).length > 0) {
    pairStatsContainer.innerHTML = '';
    
    Object.entries(statistics.tradingPairs).forEach(([pair, stats]) => {
      const pairItem = document.createElement('div');
      pairItem.className = 'pair-stat-item';
      
      const pairName = document.createElement('div');
      pairName.className = 'pair-name';
      pairName.textContent = pair;
      
      const pairMetrics = document.createElement('div');
      pairMetrics.className = 'pair-metrics';
      
      const winRateMetric = document.createElement('div');
      winRateMetric.className = 'pair-metric';
      winRateMetric.textContent = `WR: ${stats.winRate.toFixed(1)}%`;
      
      const plMetric = document.createElement('div');
      plMetric.className = 'pair-metric ' + (stats.profitLoss >= 0 ? 'profit' : 'loss');
      plMetric.textContent = `P/L: $${Math.abs(stats.profitLoss).toFixed(2)}`;
      
      const countMetric = document.createElement('div');
      countMetric.className = 'pair-metric';
      countMetric.textContent = `Count: ${stats.totalTrades}`;
      
      pairMetrics.appendChild(winRateMetric);
      pairMetrics.appendChild(plMetric);
      pairMetrics.appendChild(countMetric);
      
      pairItem.appendChild(pairName);
      pairItem.appendChild(pairMetrics);
      
      pairStatsContainer.appendChild(pairItem);
    });
  } else {
    pairStatsContainer.innerHTML = '<div class="no-data">No trading data available</div>';
  }
}

// Check connection status with the MT5 server
function checkConnectionStatus() {
  fetch(`${serverUrl}/status`)
    .then(response => response.json())
    .then(data => {
      updateConnectionStatus(data.connected);
    })
    .catch(error => {
      console.error("Error checking MT5 connection:", error);
      updateConnectionStatus(false);
      
      // If not connected, try to start the server
      tryStartServer();
    });
}

// Try to start the Python server if not already running
function tryStartServer() {
  chrome.runtime.sendMessage({ action: 'startPythonServer' });
}

// Update connection status UI
function updateConnectionStatus(isConnected) {
  if (isConnected) {
    connectionStatus.textContent = 'Connected to MT5';
    connectionStatus.className = 'connected';
    connectionIcon.className = 'status-icon connected';
  } else {
    connectionStatus.textContent = 'Not connected to MT5';
    connectionStatus.className = 'disconnected';
    connectionIcon.className = 'status-icon disconnected';
  }
  
  // Update background script
  chrome.runtime.sendMessage({ 
    action: "connectionStatusChanged", 
    isConnected: isConnected 
  });
}

// Connect to MT5 via the server
function connectToMT5() {
  fetch(`${serverUrl}/connect`)
    .then(response => response.json())
    .then(data => {
      updateConnectionStatus(data.connected);
      
      if (data.connected) {
        showToast('Connected to MetaTrader 5', 'success');
      } else {
        showToast('Failed to connect to MetaTrader 5', 'error');
      }
    })
    .catch(error => {
      console.error("Error connecting to MT5:", error);
      showToast('Error connecting to MT5 server', 'error');
      updateConnectionStatus(false);
      
      // Try to start the server if connection fails
      tryStartServer();
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
  
  // Parse trading pairs from the input
  const tradingPairsArray = tradingPairsInput.value
    .split(',')
    .map(pair => pair.trim().toUpperCase())
    .filter(pair => pair.length > 0);
  
  // Create settings object from inputs
  const settings = {
    accountSize: parseInt(accountSizeInput.value),
    riskPerTrade: parseInt(riskPerTradeInput.value),
    lotSizePerTrade: parseFloat(lotSizePerTradeInput.value),
    tradingPairs: tradingPairsArray,
    shortMAPeriod: parseInt(shortMAPeriodInput.value),
    longMAPeriod: parseInt(longMAPeriodInput.value),
    emaPeriod: parseInt(emaPeriodInput.value),
    atrLength: parseInt(atrLengthInput.value),
    cooldownPeriod: parseInt(cooldownPeriodInput.value),
    enablePyramiding: enablePyramidingInput.checked,
    maxPyramidPositions: parseInt(maxPyramidPositionsInput.value)
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
      saveBtn.classList.add('success');
      
      // Reset button after 2 seconds
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.classList.remove('success');
      }, 2000);
    }
  });
});

// Validate all input fields
function validateInputs() {
  // Validate account size
  if (accountSizeInput.value < 1) {
    showError('Account size must be at least 1 USD');
    accountSizeInput.focus();
    return false;
  }
  
  // Validate risk per trade
  if (riskPerTradeInput.value < 1) {
    showError('Risk per trade must be at least 1 USD');
    riskPerTradeInput.focus();
    return false;
  }
  
  // Validate lot size
  if (lotSizePerTradeInput.value < 0.01) {
    showError('Lot size must be at least 0.01');
    lotSizePerTradeInput.focus();
    return false;
  }
  
  // Validate trading pairs
  if (!tradingPairsInput.value.trim()) {
    showError('At least one trading pair must be specified');
    tradingPairsInput.focus();
    return false;
  }
  
  // Validate short MA period
  if (shortMAPeriodInput.value < 1) {
    showError('Short MA period must be at least 1');
    shortMAPeriodInput.focus();
    return false;
  }
  
  // Validate long MA period
  if (longMAPeriodInput.value < 1) {
    showError('Long MA period must be at least 1');
    longMAPeriodInput.focus();
    return false;
  }
  
  // Validate that short MA is less than long MA
  if (parseInt(shortMAPeriodInput.value) >= parseInt(longMAPeriodInput.value)) {
    showError('Short MA period must be less than Long MA period');
    shortMAPeriodInput.focus();
    return false;
  }
  
  // Validate EMA period
  if (emaPeriodInput.value < 1) {
    showError('EMA period must be at least 1');
    emaPeriodInput.focus();
    return false;
  }
  
  // Validate ATR length
  if (atrLengthInput.value < 1) {
    showError('ATR length must be at least 1');
    atrLengthInput.focus();
    return false;
  }
  
  // Validate cooldown period
  if (cooldownPeriodInput.value < 1) {
    showError('Cooldown period must be at least 1 minute');
    cooldownPeriodInput.focus();
    return false;
  }
  
  // Validate pyramid positions
  if (enablePyramidingInput.checked && (maxPyramidPositionsInput.value < 1 || maxPyramidPositionsInput.value > 10)) {
    showError('Max pyramid positions must be between 1 and 10');
    maxPyramidPositionsInput.focus();
    return false;
  }
  
  return true;
}

// Show error toast
function showError(message) {
  showToast(message, 'error');
}

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `error-toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Add connect button functionality
const connectBtn = document.createElement('button');
connectBtn.textContent = 'Connect to MT5';
connectBtn.className = 'btn primary-btn';
connectBtn.style.marginTop = '10px';
connectBtn.addEventListener('click', connectToMT5);

// Insert connect button after connection status
const connectionStatusDiv = document.querySelector('.connection-status');
connectionStatusDiv.appendChild(connectBtn);

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);

// Refresh statistics periodically
setInterval(() => {
  chrome.runtime.sendMessage({ action: 'getTradeStatistics' }, (response) => {
    if (response && response.statistics) {
      updateStatisticsUI(response.statistics);
    }
  });
}, 5000);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "connectionStatusChanged") {
    updateConnectionStatus(message.isConnected);
  } else if (message.action === "statisticsUpdated") {
    updateStatisticsUI(message.statistics);
  }
  
  return true;
});

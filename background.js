
// Background script for the extension
let isEnabled = false;
let isConnectedToMT5 = false;

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getState") {
    // Return the current state
    sendResponse({ isEnabled, isConnectedToMT5 });
  } else if (message.action === "toggleEnabled") {
    // Toggle the enabled state
    isEnabled = message.value;
    
    // Save state to storage
    chrome.storage.local.set({ isEnabled });
    
    // Broadcast to all tabs that state has changed
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: "stateChanged", isEnabled });
      });
    });
    
    sendResponse({ isEnabled });
  } else if (message.action === "saveSettings") {
    // Save settings to storage
    chrome.storage.local.set({ settings: message.settings });
    
    // Broadcast to all tabs that settings have changed
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { 
          action: "settingsChanged", 
          settings: message.settings 
        });
      });
    });
    
    sendResponse({ success: true });
  } else if (message.action === "connectionStatusChanged") {
    // Update connection status
    isConnectedToMT5 = message.isConnected;
    
    // Update badge and tooltip to indicate connection status
    if (isConnectedToMT5) {
      chrome.action.setBadgeText({ text: "MT5" });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
      chrome.action.setTitle({ title: "Connected to MT5" });
    } else {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "MT5 Trade Trigger" });
    }
  } else if (message.action === "openPopup") {
    // Open the popup programmatically
    chrome.action.openPopup();
  }
  
  return true;
});

// Check MT5 connection status periodically in active tabs
function checkConnectionStatus() {
  chrome.tabs.query({ active: true }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: "checkConnection" }, (response) => {
        // Only update if we got a response
        if (response && typeof response.isConnected !== 'undefined') {
          isConnectedToMT5 = response.isConnected;
          
          // Update badge
          if (isConnectedToMT5) {
            chrome.action.setBadgeText({ text: "MT5" });
            chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
            chrome.action.setTitle({ title: "Connected to MT5" });
          } else {
            chrome.action.setBadgeText({ text: "" });
            chrome.action.setTitle({ title: "MT5 Trade Trigger" });
          }
        }
      });
    });
  });
}

// Initialize state from storage when the extension loads
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["isEnabled", "settings"], (result) => {
    isEnabled = result.isEnabled || false;
    
    // If settings don't exist, set default values
    if (!result.settings) {
      const defaultSettings = {
        accountSize: 5000,
        riskPerTrade: 20,
        lotSizePerTrade: 1.0,
        shortMAPeriod: 15,
        longMAPeriod: 100,
        emaPeriod: 200,
        atrLength: 14,
        cooldownPeriod: 10,
        enablePyramiding: false,
        maxPyramidPositions: 3
      };
      
      chrome.storage.local.set({ settings: defaultSettings });
    }
  });
  
  // Start periodic connection checks
  setInterval(checkConnectionStatus, 5000);
});

// Listen for tab updates to detect when MT5 might be loaded
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
     (tab.url.includes('metatrader5') || 
      tab.url.includes('mql5') || 
      tab.url.includes('metaquotes'))) {
    
    // Wait a moment for the page to fully render, then check connection
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: "checkConnection" });
    }, 2000);
  }
});

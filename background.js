
// Background script for the extension
let isEnabled = false;
let isConnectedToMT5 = false;
let serverUrl = "http://localhost:5555";

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

// Check MT5 connection status periodically
function checkConnectionStatus() {
  fetch(`${serverUrl}/status`)
    .then(response => response.json())
    .then(data => {
      isConnectedToMT5 = data.connected;
      
      // Update badge
      if (isConnectedToMT5) {
        chrome.action.setBadgeText({ text: "MT5" });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
        chrome.action.setTitle({ title: "Connected to MT5" });
      } else {
        chrome.action.setBadgeText({ text: "" });
        chrome.action.setTitle({ title: "MT5 Trade Trigger" });
      }
      
      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { 
            action: "connectionStatusChanged", 
            isConnected: isConnectedToMT5 
          });
        });
      });
    })
    .catch(error => {
      console.error("Error checking MT5 connection:", error);
      isConnectedToMT5 = false;
      
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "MT5 Trade Trigger" });
      
      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { 
            action: "connectionStatusChanged", 
            isConnected: false
          });
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

// Listen for tab updates to inject our UI on relevant sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a trading-related website
    const tradingDomains = [
      'metatrader5', 'mql5', 'metaquotes', 'tradingview', 
      'forex', 'trading', 'fxcm', 'oanda', 'mt5'
    ];
    
    const isTradingRelated = tradingDomains.some(domain => 
      tab.url.toLowerCase().includes(domain)
    );
    
    if (isTradingRelated) {
      // Inject our UI
      chrome.tabs.sendMessage(tabId, { action: "injectUI" });
      
      // Check connection status immediately
      checkConnectionStatus();
    }
  }
});

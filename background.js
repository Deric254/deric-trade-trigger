
// Background script for the extension
let isEnabled = false;

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getState") {
    // Return the current state
    sendResponse({ isEnabled });
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
  }
  return true;
});

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
        cooldownPeriod: 10
      };
      
      chrome.storage.local.set({ settings: defaultSettings });
    }
  });
});

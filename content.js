
// Content script for MT5 Trade Trigger extension
console.log("MT5 Trade Trigger content script loaded");

// State variables
let isEnabled = false;
let settings = null;
let lastCrossoverState = null;
let lastTradeTime = 0;
let priceData = [];
let maxPriceDataPoints = 300; // Keep enough data for calculations

// Initialize when the content script loads
function initialize() {
  // Get current extension state and settings from storage
  chrome.storage.local.get(["isEnabled", "settings"], (result) => {
    isEnabled = result.isEnabled || false;
    settings = result.settings || getDefaultSettings();
    console.log("MT5 Trade Trigger initialized:", { isEnabled, settings });
  });
  
  // Start monitoring for MT5
  checkForMT5Interface();
}

// Default settings if none are saved
function getDefaultSettings() {
  return {
    accountSize: 5000,
    riskPerTrade: 20,
    lotSizePerTrade: 1.0,
    shortMAPeriod: 15,
    longMAPeriod: 100,
    emaPeriod: 200,
    atrLength: 14,
    cooldownPeriod: 10
  };
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "stateChanged") {
    isEnabled = message.isEnabled;
    console.log("Extension state changed:", isEnabled);
    
    if (isEnabled) {
      // Reset state when enabled
      lastCrossoverState = null;
      priceData = [];
    }
  } else if (message.action === "settingsChanged") {
    settings = message.settings;
    console.log("Settings updated:", settings);
    
    // Reset trading state when settings change
    lastCrossoverState = null;
  }
  
  return true;
});

// Check if we're on MT5 platform and set up monitoring
function checkForMT5Interface() {
  // Check if we're on MT5 platform
  const isMT5 = 
    window.location.hostname.includes("metatrader5") || 
    window.location.hostname.includes("mql5") ||
    window.location.hostname.includes("metaquotes");
  
  if (isMT5) {
    console.log("MT5 interface detected. Setting up price monitoring.");
    
    // Set up a timer to check for price data and calculate indicators
    setInterval(monitorPriceData, 1000);
    
    // Inject CSS for trade notification
    injectNotificationStyles();
  }
}

// Inject CSS for trade notifications
function injectNotificationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .mt5-trade-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .mt5-trade-notification.buy { border-left: 4px solid #4CAF50; }
    .mt5-trade-notification.sell { border-left: 4px solid #F44336; }
  `;
  document.head.appendChild(style);
}

// Monitor price data from the MT5 interface
function monitorPriceData() {
  if (!isEnabled || !settings) return;
  
  // Try to find price data in MT5's DOM (this is a simplified example)
  const priceElements = document.querySelectorAll('.price, .bid, .ask, [data-price]');
  
  if (priceElements.length > 0) {
    // Extract latest price (this would need to be adjusted to the actual MT5 interface)
    let currentPrice = null;
    priceElements.forEach(el => {
      const price = parseFloat(el.textContent.replace(/[^\d.-]/g, ''));
      if (!isNaN(price) && price > 0) {
        currentPrice = price;
      }
    });
    
    if (currentPrice) {
      // Add new price data point
      const timestamp = Date.now();
      priceData.push({ time: timestamp, price: currentPrice });
      
      // Limit the size of the price data array
      if (priceData.length > maxPriceDataPoints) {
        priceData.shift();
      }
      
      // If we have enough data, calculate indicators
      if (priceData.length >= settings.longMAPeriod + 10) {
        calculateIndicatorsAndTriggerTrades();
      }
    }
  }
}

// Calculate technical indicators and check for trade signals
function calculateIndicatorsAndTriggerTrades() {
  if (priceData.length < Math.max(settings.longMAPeriod, settings.emaPeriod)) return;
  
  const prices = priceData.map(data => data.price);
  const currentTime = Date.now();
  
  // Calculate moving averages
  const shortMA = calculateSMA(prices, settings.shortMAPeriod);
  const longMA = calculateSMA(prices, settings.longMAPeriod);
  const ema200 = calculateEMA(prices, settings.emaPeriod);
  
  // Calculate ATR for volatility
  const atrValue = calculateATR(prices, settings.atrLength);
  
  // Current price is the latest price
  const currentPrice = prices[prices.length - 1];
  
  // Determine crossover state (1 = shortMA above longMA, -1 = shortMA below longMA)
  const currentCrossoverState = shortMA > longMA ? 1 : -1;
  
  // Check for a crossover
  if (lastCrossoverState !== null && lastCrossoverState !== currentCrossoverState) {
    // Check time-based cooldown
    const cooldownTimeMs = settings.cooldownPeriod * 60 * 1000; // Convert minutes to ms
    if (currentTime - lastTradeTime >= cooldownTimeMs) {
      
      // Long condition: shortMA crosses above longMA and price is above EMA200
      if (currentCrossoverState === 1 && currentPrice > ema200) {
        const stopLoss = currentPrice - atrValue;
        const takeProfit = currentPrice + (atrValue * 2); // 1:2 risk-reward ratio
        
        triggerTrade("buy", {
          price: currentPrice,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          lotSize: settings.lotSizePerTrade
        });
        
        lastTradeTime = currentTime;
      }
      // Short condition: shortMA crosses below longMA and price is below EMA200
      else if (currentCrossoverState === -1 && currentPrice < ema200) {
        const stopLoss = currentPrice + atrValue;
        const takeProfit = currentPrice - (atrValue * 2); // 1:2 risk-reward ratio
        
        triggerTrade("sell", {
          price: currentPrice,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          lotSize: settings.lotSizePerTrade
        });
        
        lastTradeTime = currentTime;
      }
    }
  }
  
  // Update last crossover state
  lastCrossoverState = currentCrossoverState;
}

// Calculate Simple Moving Average (SMA)
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  
  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / period;
}

// Calculate Exponential Moving Average (EMA)
function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  
  // First EMA is calculated as SMA
  let ema = calculateSMA(prices.slice(0, period), period);
  const multiplier = 2 / (period + 1);
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// Calculate Average True Range (ATR)
function calculateATR(prices, period) {
  if (prices.length < period + 1) return null;
  
  const trValues = [];
  
  // Calculate True Range values
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i];
    const low = prices[i];
    const previousClose = prices[i-1];
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - previousClose);
    const tr3 = Math.abs(low - previousClose);
    
    const trueRange = Math.max(tr1, tr2, tr3);
    trValues.push(trueRange);
  }
  
  // Calculate ATR as average of True Range values
  const atrValues = trValues.slice(-period);
  return atrValues.reduce((sum, tr) => sum + tr, 0) / period;
}

// Trigger a trade based on the signal
function triggerTrade(direction, details) {
  console.log(`MT5 Trade Trigger: ${direction.toUpperCase()} signal detected`, details);
  
  // Display notification to the user
  showTradeNotification(direction, details);
  
  // Try to click on trade buttons in MT5
  attemptToTriggerTradeUI(direction, details);
}

// Show a notification for the trade signal
function showTradeNotification(direction, details) {
  const notification = document.createElement('div');
  notification.className = `mt5-trade-notification ${direction}`;
  notification.innerHTML = `
    <strong>${direction.toUpperCase()} Signal</strong><br>
    Price: ${details.price.toFixed(5)}<br>
    Stop Loss: ${details.stopLoss.toFixed(5)}<br>
    Take Profit: ${details.takeProfit.toFixed(5)}<br>
    Lot Size: ${details.lotSize}
  `;
  
  document.body.appendChild(notification);
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Attempt to interact with MT5's UI to trigger the trade
function attemptToTriggerTradeUI(direction, details) {
  // This function would need to be customized to the specific MT5 interface
  // It would locate and click UI elements to place trades
  
  // Example (this is simplified and would need to be adapted)
  const buyButtons = document.querySelectorAll('.buy-button, [data-action="buy"]');
  const sellButtons = document.querySelectorAll('.sell-button, [data-action="sell"]');
  
  if (direction === "buy" && buyButtons.length > 0) {
    console.log("Attempting to click buy button");
    buyButtons[0].click();
  } else if (direction === "sell" && sellButtons.length > 0) {
    console.log("Attempting to click sell button");
    sellButtons[0].click();
  }
  
  // Additional code would be needed to set stop loss, take profit, and lot size
}

// Initialize the content script
initialize();

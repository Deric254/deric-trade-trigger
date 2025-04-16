// Content script for MT5 Trade Trigger extension
console.log("MT5 Trade Trigger content script loaded");

// State variables
let isEnabled = false;
let settings = null;
let lastCrossoverState = null;
let lastTradeTime = 0;
let priceData = [];
let maxPriceDataPoints = 300; // Keep enough data for calculations
let isConnectedToMT5 = false;

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
    cooldownPeriod: 10,
    enablePyramiding: false,
    maxPyramidPositions: 3
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
  } else if (message.action === "checkConnection") {
    // Respond with connection status
    sendResponse({ isConnected: isConnectedToMT5 });
    return true;
  }
  
  return true;
});

// Check if we're on MT5 platform and set up monitoring
function checkForMT5Interface() {
  // Check if we're on MT5 platform using more reliable methods
  const isMT5 = detectMT5Platform();
  
  if (isMT5) {
    console.log("MT5 interface detected. Setting up price monitoring.");
    isConnectedToMT5 = true;
    
    // Update connection status
    chrome.runtime.sendMessage({ 
      action: "connectionStatusChanged", 
      isConnected: true 
    });
    
    // Inject the widget UI
    injectTradeWidget();
    
    // Set up a timer to check for price data and calculate indicators
    setInterval(monitorPriceData, 1000);
    
    // Inject CSS for trade notification and widget
    injectStyles();
  } else {
    // Try again after a delay - sometimes pages load elements dynamically
    setTimeout(checkForMT5Interface, 2000);
  }
}

// More comprehensive MT5 detection
function detectMT5Platform() {
  // Look for various MT5-specific elements or URLs
  const isMetaTraderURL = 
    window.location.hostname.includes("metatrader5") || 
    window.location.hostname.includes("mql5") ||
    window.location.hostname.includes("metaquotes") ||
    window.location.pathname.includes("terminal");
  
  // Look for specific MT5 web terminal elements
  const hasMT5Elements = 
    document.querySelector('.chart') ||
    document.querySelector('[data-symbol]') ||
    document.querySelector('.terminal') ||
    document.querySelector('.quote') ||
    document.getElementById('terminal') ||
    document.getElementById('chart');
  
  // Check for MT5 global objects (if accessible)
  const hasMT5Objects = 
    typeof window.MetaTraderWeb !== 'undefined' || 
    typeof window.MT5WebTerminal !== 'undefined';
  
  return isMetaTraderURL || hasMT5Elements || hasMT5Objects;
}

// Inject CSS styles for notifications and widget
function injectStyles() {
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
    
    .mt5-trade-widget {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 250px;
      background-color: rgba(30, 30, 30, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .mt5-trade-widget h3 {
      margin: 0 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 16px;
      font-weight: 500;
    }
    
    .mt5-widget-status {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .status-active {
      background-color: #4CAF50;
      box-shadow: 0 0 5px #4CAF50;
    }
    
    .status-inactive {
      background-color: #F44336;
      box-shadow: 0 0 5px #F44336;
    }
    
    .mt5-widget-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 15px;
    }
    
    .mt5-widget-actions button {
      background-color: #2196F3;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: background-color 0.2s;
    }
    
    .mt5-widget-actions button:hover {
      background-color: #0d8bf2;
    }
    
    .mt5-widget-actions button.active {
      background-color: #4CAF50;
    }
    
    .mt5-widget-actions button.inactive {
      background-color: #F44336;
    }
    
    .trade-stat {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 13px;
    }
    
    .trade-stat-value {
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
}

// Inject trade widget
function injectTradeWidget() {
  const widget = document.createElement('div');
  widget.className = 'mt5-trade-widget';
  widget.innerHTML = `
    <h3>MT5 Trade Trigger</h3>
    <div class="mt5-widget-status">
      <div class="status-indicator ${isEnabled ? 'status-active' : 'status-inactive'}"></div>
      <span>${isEnabled ? 'Active' : 'Inactive'}</span>
    </div>
    
    <div class="trade-statistics">
      <div class="trade-stat">
        <span>Strategy:</span>
        <span class="trade-stat-value">MA Crossover + EMA Filter</span>
      </div>
      <div class="trade-stat">
        <span>Last signal:</span>
        <span class="trade-stat-value" id="last-signal">None</span>
      </div>
      <div class="trade-stat">
        <span>Trades today:</span>
        <span class="trade-stat-value" id="trades-today">0</span>
      </div>
    </div>
    
    <div class="mt5-widget-actions">
      <button id="toggle-trading" class="${isEnabled ? 'active' : 'inactive'}">
        ${isEnabled ? 'Stop Trading' : 'Start Trading'}
      </button>
      <button id="open-settings">Settings</button>
    </div>
  `;
  
  document.body.appendChild(widget);
  
  // Add event listeners
  document.getElementById('toggle-trading').addEventListener('click', () => {
    isEnabled = !isEnabled;
    chrome.storage.local.set({ isEnabled });
    chrome.runtime.sendMessage({ action: 'toggleEnabled', value: isEnabled });
    updateWidgetState();
  });
  
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
}

// Update widget state based on current settings
function updateWidgetState() {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = statusIndicator.nextElementSibling;
  const toggleButton = document.getElementById('toggle-trading');
  
  if (isEnabled) {
    statusIndicator.classList.remove('status-inactive');
    statusIndicator.classList.add('status-active');
    statusText.textContent = 'Active';
    toggleButton.textContent = 'Stop Trading';
    toggleButton.classList.remove('inactive');
    toggleButton.classList.add('active');
  } else {
    statusIndicator.classList.remove('status-active');
    statusIndicator.classList.add('status-inactive');
    statusText.textContent = 'Inactive';
    toggleButton.textContent = 'Start Trading';
    toggleButton.classList.remove('active');
    toggleButton.classList.add('inactive');
  }
}

// Monitor price data from the MT5 interface
function monitorPriceData() {
  if (!isEnabled || !settings) return;
  
  // Try to find price data in MT5's DOM with enhanced methods
  const currentPrice = extractPriceFromMT5();
  
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

// Enhanced price extraction from MT5
function extractPriceFromMT5() {
  // Try multiple DOM elements where price might be located
  const priceSelectors = [
    '.chart-price', 
    '.price', 
    '.bid', 
    '.ask', 
    '[data-price]',
    '.quote-price',
    '#price',
    '.live-price',
    '.chart-panel-price'
  ];
  
  // Check various elements for price information
  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    
    if (elements.length > 0) {
      for (const element of elements) {
        // Extract numbers from element text
        const priceText = element.textContent || element.getAttribute('data-price') || '';
        const price = parseFloat(priceText.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }
  }
  
  // Fallback for MQL5 charts - try to get price from chart title
  const chartTitles = document.querySelectorAll('.chart-title, .symbol-title');
  for (const title of chartTitles) {
    const titleText = title.textContent || '';
    const priceMatch = titleText.match(/(\d+\.\d+)/);
    if (priceMatch && priceMatch[1]) {
      const price = parseFloat(priceMatch[1]);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }
  
  return null;
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
  
  // Update widget with latest data
  updateWidgetWithLatestData({
    shortMA,
    longMA,
    ema200,
    currentPrice,
    crossoverState: currentCrossoverState
  });
  
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
        
        // Update last trade time and widget
        lastTradeTime = currentTime;
        document.getElementById('last-signal').textContent = 'BUY';
        incrementTradeCounter();
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
        
        // Update last trade time and widget
        lastTradeTime = currentTime;
        document.getElementById('last-signal').textContent = 'SELL';
        incrementTradeCounter();
      }
    }
  }
  
  // Update last crossover state
  lastCrossoverState = currentCrossoverState;
}

// Update widget with latest indicator data
function updateWidgetWithLatestData(data) {
  // This function updates the widget with latest indicator values
  // but only if the widget exists in the DOM
  const lastSignalElement = document.getElementById('last-signal');
  if (lastSignalElement) {
    // You could add more information here if needed
    // For now we just keep the last signal indication
  }
}

// Increment trade counter in the widget
function incrementTradeCounter() {
  const tradesElement = document.getElementById('trades-today');
  if (tradesElement) {
    const currentCount = parseInt(tradesElement.textContent) || 0;
    tradesElement.textContent = currentCount + 1;
  }
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
  // Enhanced version with more robust selectors for various MT5 web interfaces
  const buySelectors = [
    '.buy-button', 
    '[data-action="buy"]', 
    '[title*="Buy"]', 
    '[class*="buy"]', 
    'button:contains("Buy")',
    '[data-order-type="buy"]',
    '[data-direction="buy"]',
    '.new-order-buy',
    '#placeOrderBuy'
  ];
  
  const sellSelectors = [
    '.sell-button', 
    '[data-action="sell"]', 
    '[title*="Sell"]', 
    '[class*="sell"]', 
    'button:contains("Sell")',
    '[data-order-type="sell"]',
    '[data-direction="sell"]',
    '.new-order-sell',
    '#placeOrderSell'
  ];
  
  try {
    // Try to find and click the appropriate button
    if (direction === "buy") {
      for (const selector of buySelectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
          console.log(`Found ${buttons.length} buy buttons with selector: ${selector}`);
          buttons[0].click();
          
          // After clicking, try to set stop loss, take profit, and lot size
          setTimeout(() => setOrderParameters(details), 500);
          return;
        }
      }
    } else if (direction === "sell") {
      for (const selector of sellSelectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
          console.log(`Found ${buttons.length} sell buttons with selector: ${selector}`);
          buttons[0].click();
          
          // After clicking, try to set stop loss, take profit, and lot size
          setTimeout(() => setOrderParameters(details), 500);
          return;
        }
      }
    }
    
    console.log("Could not find buy/sell buttons automatically. MT5 interface may have changed.");
  } catch (err) {
    console.error("Error attempting to trigger trade UI:", err);
  }
}

// Try to set order parameters (stop loss, take profit, lot size)
function setOrderParameters(details) {
  try {
    // Selectors for order form fields (these vary greatly by MT5 implementation)
    const lotSizeSelectors = [
      '[name="volume"]', 
      '[data-type="volume"]',
      '[placeholder="Volume"]',
      '#volume',
      '.volume-control',
      '[name="lotSize"]',
      'input[type="number"][step="0.01"]'
    ];
    
    const slSelectors = [
      '[name="sl"]', 
      '[data-type="sl"]',
      '[placeholder="Stop Loss"]',
      '#stopLoss',
      '.stop-loss-control',
      '[name="stopLoss"]'
    ];
    
    const tpSelectors = [
      '[name="tp"]', 
      '[data-type="tp"]',
      '[placeholder="Take Profit"]',
      '#takeProfit',
      '.take-profit-control',
      '[name="takeProfit"]'
    ];
    
    // Try to set lot size
    for (const selector of lotSizeSelectors) {
      const lotInputs = document.querySelectorAll(selector);
      if (lotInputs.length > 0) {
        console.log(`Setting lot size to ${details.lotSize}`);
        setInputValue(lotInputs[0], details.lotSize);
      }
    }
    
    // Try to set stop loss
    for (const selector of slSelectors) {
      const slInputs = document.querySelectorAll(selector);
      if (slInputs.length > 0) {
        console.log(`Setting stop loss to ${details.stopLoss.toFixed(5)}`);
        setInputValue(slInputs[0], details.stopLoss.toFixed(5));
      }
    }
    
    // Try to set take profit
    for (const selector of tpSelectors) {
      const tpInputs = document.querySelectorAll(selector);
      if (tpInputs.length > 0) {
        console.log(`Setting take profit to ${details.takeProfit.toFixed(5)}`);
        setInputValue(tpInputs[0], details.takeProfit.toFixed(5));
      }
    }
    
    // Look for confirm/submit button
    const confirmSelectors = [
      '.confirm-button',
      '[type="submit"]',
      'button:contains("Confirm")',
      'button:contains("Place Order")',
      '.submit-order',
      '#submitOrder',
      '.order-confirm'
    ];
    
    for (const selector of confirmSelectors) {
      const confirmButtons = document.querySelectorAll(selector);
      if (confirmButtons.length > 0) {
        console.log('Clicking confirm button');
        confirmButtons[0].click();
        return;
      }
    }
  } catch (err) {
    console.error("Error setting order parameters:", err);
  }
}

// Helper function to set input value and trigger change event
function setInputValue(element, value) {
  // Set the value
  element.value = value;
  
  // Trigger change events
  const changeEvent = new Event('change', { bubbles: true });
  const inputEvent = new Event('input', { bubbles: true });
  
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
}

// Initialize the content script
initialize();

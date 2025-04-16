// Content script for MT5 Trade Trigger extension
console.log("MT5 Trade Trigger content script loaded");

// State variables
let isEnabled = false;
let settings = null;
let lastCrossoverState = null;
let lastTradeTime = 0;
let priceData = [];
let maxPriceDataPoints = 300;
let isConnectedToMT5 = false;
let serverUrl = "http://localhost:5555";
let activePositions = [];
let currentSymbol = "EURUSD"; // Default symbol

// Initialize when the content script loads
function initialize() {
  // Get current extension state and settings from storage
  chrome.storage.local.get(["isEnabled", "settings"], (result) => {
    isEnabled = result.isEnabled || false;
    settings = result.settings || getDefaultSettings();
    console.log("MT5 Trade Trigger initialized:", { isEnabled, settings });
  });
  
  // Check if we're on a MT5 or trading related website
  if (isTradingRelatedSite()) {
    // Inject the widget UI
    injectTradeWidget();
    
    // Inject CSS for trade notification and widget
    injectStyles();
    
    // Start checking connection status
    checkConnectionStatus();
    
    // Start price monitoring
    setInterval(monitorPriceData, 1000);
    
    // Get active positions periodically
    setInterval(updatePositions, 5000);
  }
}

// Check if current site is trading related
function isTradingRelatedSite() {
  const tradingDomains = [
    'metatrader5', 'mql5', 'metaquotes', 'tradingview', 
    'forex', 'trading', 'fxcm', 'oanda', 'mt5'
  ];
  
  const hostname = window.location.hostname.toLowerCase();
  return tradingDomains.some(domain => hostname.includes(domain));
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
    
    updateWidgetState();
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

// Check connection status with the MT5 server
function checkConnectionStatus() {
  fetch(`${serverUrl}/status`)
    .then(response => response.json())
    .then(data => {
      isConnectedToMT5 = data.connected;
      
      // Update connection status in the UI
      updateConnectionUI(isConnectedToMT5);
      
      // Update background script
      chrome.runtime.sendMessage({ 
        action: "connectionStatusChanged", 
        isConnected: isConnectedToMT5 
      });
    })
    .catch(error => {
      console.error("Error checking MT5 connection:", error);
      isConnectedToMT5 = false;
      updateConnectionUI(false);
      
      chrome.runtime.sendMessage({ 
        action: "connectionStatusChanged", 
        isConnected: false 
      });
    });
}

// Update UI based on connection status
function updateConnectionUI(isConnected) {
  const connectionIndicator = document.querySelector('.mt5-connection-indicator');
  const connectionText = document.querySelector('.mt5-connection-text');
  
  if (connectionIndicator && connectionText) {
    if (isConnected) {
      connectionIndicator.classList.remove('disconnected');
      connectionIndicator.classList.add('connected');
      connectionText.textContent = 'Connected to MT5';
    } else {
      connectionIndicator.classList.remove('connected');
      connectionIndicator.classList.add('disconnected');
      connectionText.textContent = 'Not connected to MT5';
    }
  }
}

// Connect to MT5 via the server
function connectToMT5() {
  fetch(`${serverUrl}/connect`)
    .then(response => response.json())
    .then(data => {
      isConnectedToMT5 = data.connected;
      updateConnectionUI(isConnectedToMT5);
      
      if (isConnectedToMT5) {
        showNotification('Connected to MetaTrader 5', 'success');
      } else {
        showNotification('Failed to connect to MetaTrader 5', 'error');
      }
      
      chrome.runtime.sendMessage({ 
        action: "connectionStatusChanged", 
        isConnected: isConnectedToMT5 
      });
    })
    .catch(error => {
      console.error("Error connecting to MT5:", error);
      showNotification('Error connecting to MT5 server', 'error');
      isConnectedToMT5 = false;
      updateConnectionUI(false);
    });
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
      transition: all 0.3s ease;
      max-width: 300px;
    }
    .mt5-trade-notification.success { border-left: 4px solid #4CAF50; }
    .mt5-trade-notification.error { border-left: 4px solid #F44336; }
    .mt5-trade-notification.buy { border-left: 4px solid #4CAF50; }
    .mt5-trade-notification.sell { border-left: 4px solid #F44336; }
    
    .mt5-trade-widget {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 280px;
      background-color: rgba(30, 30, 30, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9998;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }
    
    .mt5-trade-widget h3 {
      margin: 0 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 16px;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .mt5-widget-close {
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .mt5-widget-close:hover {
      opacity: 1;
    }
    
    .mt5-widget-status {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      justify-content: space-between;
    }
    
    .status-indicator {
      display: flex;
      align-items: center;
    }
    
    .mt5-connection-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .mt5-connection-indicator.connected {
      background-color: #4CAF50;
      box-shadow: 0 0 5px #4CAF50;
    }
    
    .mt5-connection-indicator.disconnected {
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
    
    .mt5-widget-positions {
      margin-top: 15px;
      max-height: 150px;
      overflow-y: auto;
      font-size: 12px;
    }
    
    .mt5-position-item {
      background-color: rgba(255, 255, 255, 0.1);
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
    }
    
    .mt5-position-item.buy {
      border-left: 3px solid #4CAF50;
    }
    
    .mt5-position-item.sell {
      border-left: 3px solid #F44336;
    }
    
    .position-details {
      display: flex;
      flex-direction: column;
    }
    
    .position-symbol {
      font-weight: 500;
    }
    
    .position-profit {
      font-weight: 500;
    }
    
    .position-profit.positive {
      color: #4CAF50;
    }
    
    .position-profit.negative {
      color: #F44336;
    }
    
    .position-action {
      display: flex;
      align-items: center;
    }
    
    .position-close {
      background-color: rgba(244, 67, 54, 0.2);
      color: white;
      border: none;
      border-radius: 3px;
      padding: 3px 6px;
      cursor: pointer;
      font-size: 11px;
      transition: background-color 0.2s;
    }
    
    .position-close:hover {
      background-color: rgba(244, 67, 54, 0.4);
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
    
    .mt5-controls {
      display: flex;
      justify-content: space-between;
      gap: 5px;
      margin-top: 10px;
    }
    
    .mt5-controls button {
      flex: 1;
      padding: 8px 0;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .mt5-buy-btn {
      background-color: rgba(76, 175, 80, 0.2);
      color: #4CAF50;
    }
    
    .mt5-buy-btn:hover {
      background-color: rgba(76, 175, 80, 0.4);
    }
    
    .mt5-sell-btn {
      background-color: rgba(244, 67, 54, 0.2);
      color: #F44336;
    }
    
    .mt5-sell-btn:hover {
      background-color: rgba(244, 67, 54, 0.4);
    }
    
    .mt5-close-all-btn {
      background-color: rgba(158, 158, 158, 0.2);
      color: white;
      font-size: 12px;
    }
    
    .mt5-close-all-btn:hover {
      background-color: rgba(158, 158, 158, 0.4);
    }
    
    .symbol-selector {
      margin-top: 10px;
      width: 100%;
      padding: 6px;
      background-color: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: white;
      font-size: 13px;
    }
    
    .symbol-selector option {
      background-color: #1e1e1e;
    }
    
    .minimized-widget {
      width: 40px !important;
      height: 40px !important;
      border-radius: 50% !important;
      overflow: hidden;
      padding: 0 !important;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      font-size: 20px;
    }
    
    .minimized-widget * {
      display: none;
    }
    
    .minimized-widget::after {
      content: "MT5";
      font-size: 14px;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}

// Inject trade widget
function injectTradeWidget() {
  const widget = document.createElement('div');
  widget.className = 'mt5-trade-widget';
  widget.id = 'mt5-trade-widget';
  widget.innerHTML = `
    <h3>
      <span>MT5 Trade Trigger</span>
      <span class="mt5-widget-close" id="minimize-widget">–</span>
    </h3>
    <div class="mt5-widget-status">
      <div class="status-indicator">
        <div class="mt5-connection-indicator disconnected"></div>
        <span class="mt5-connection-text">Not connected to MT5</span>
      </div>
      <div>
        <div class="trading-status">
          <div class="status-indicator ${isEnabled ? 'status-active' : 'status-inactive'}"></div>
          <span>${isEnabled ? 'Trading Active' : 'Trading Inactive'}</span>
        </div>
      </div>
    </div>
    
    <select class="symbol-selector" id="symbol-selector">
      <option value="EURUSD">EUR/USD</option>
      <option value="GBPUSD">GBP/USD</option>
      <option value="USDJPY">USD/JPY</option>
      <option value="AUDUSD">AUD/USD</option>
      <option value="USDCAD">USD/CAD</option>
      <option value="NZDUSD">NZD/USD</option>
    </select>
    
    <div class="mt5-controls">
      <button id="buy-button" class="mt5-buy-btn">BUY</button>
      <button id="sell-button" class="mt5-sell-btn">SELL</button>
      <button id="close-all-button" class="mt5-close-all-btn">CLOSE ALL</button>
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
    
    <div class="mt5-widget-positions" id="positions-container">
      <div class="no-positions">No active positions</div>
    </div>
    
    <div class="mt5-widget-actions">
      <button id="toggle-trading" class="${isEnabled ? 'active' : 'inactive'}">
        ${isEnabled ? 'Stop Trading' : 'Start Trading'}
      </button>
      <button id="connect-button">Connect to MT5</button>
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
  
  document.getElementById('connect-button').addEventListener('click', () => {
    connectToMT5();
  });
  
  document.getElementById('buy-button').addEventListener('click', () => {
    const symbol = document.getElementById('symbol-selector').value;
    executeTrade('buy', symbol);
  });
  
  document.getElementById('sell-button').addEventListener('click', () => {
    const symbol = document.getElementById('symbol-selector').value;
    executeTrade('sell', symbol);
  });
  
  document.getElementById('close-all-button').addEventListener('click', () => {
    closeAllPositions();
  });
  
  document.getElementById('symbol-selector').addEventListener('change', (e) => {
    currentSymbol = e.target.value;
  });
  
  // Minimize/maximize widget functionality
  let isMinimized = false;
  document.getElementById('minimize-widget').addEventListener('click', () => {
    const widget = document.getElementById('mt5-trade-widget');
    
    if (!isMinimized) {
      widget.classList.add('minimized-widget');
      document.getElementById('minimize-widget').textContent = '+';
    } else {
      widget.classList.remove('minimized-widget');
      document.getElementById('minimize-widget').textContent = '–';
    }
    
    isMinimized = !isMinimized;
  });
}

// Update widget state based on current settings
function updateWidgetState() {
  const toggleButton = document.getElementById('toggle-trading');
  if (!toggleButton) return;
  
  if (isEnabled) {
    toggleButton.textContent = 'Stop Trading';
    toggleButton.classList.remove('inactive');
    toggleButton.classList.add('active');
  } else {
    toggleButton.textContent = 'Start Trading';
    toggleButton.classList.remove('active');
    toggleButton.classList.add('inactive');
  }
}

// Monitor price data from the MT5 server
function monitorPriceData() {
  if (!isEnabled || !settings || !isConnectedToMT5) return;
  
  const symbol = currentSymbol || "EURUSD";
  
  fetch(`${serverUrl}/prices`)
    .then(response => response.json())
    .then(data => {
      if (data && data[symbol]) {
        const price = data[symbol];
        const timestamp = Date.now();
        
        // Calculate mid price as average of bid and ask
        const midPrice = (price.bid + price.ask) / 2;
        
        // Add new price data point
        priceData.push({ time: timestamp, price: midPrice });
        
        // Limit the size of the price data array
        if (priceData.length > maxPriceDataPoints) {
          priceData.shift();
        }
        
        // If we have enough data, calculate indicators
        if (priceData.length >= settings.longMAPeriod + 10) {
          calculateIndicatorsAndTriggerTrades(symbol);
        }
      }
    })
    .catch(error => {
      console.error("Error fetching price data:", error);
    });
}

// Update active positions
function updatePositions() {
  if (!isConnectedToMT5) return;
  
  fetch(`${serverUrl}/positions`)
    .then(response => response.json())
    .then(positions => {
      activePositions = positions;
      
      // Update positions in widget
      updatePositionsWidget();
    })
    .catch(error => {
      console.error("Error fetching positions:", error);
    });
}

// Update positions in widget
function updatePositionsWidget() {
  const container = document.getElementById('positions-container');
  if (!container) return;
  
  if (activePositions.length === 0) {
    container.innerHTML = '<div class="no-positions">No active positions</div>';
    return;
  }
  
  let html = '';
  
  activePositions.forEach(position => {
    const isProfit = position.profit > 0;
    
    html += `
      <div class="mt5-position-item ${position.type}">
        <div class="position-details">
          <span class="position-symbol">${position.symbol}</span>
          <span>${position.type.toUpperCase()} ${position.volume}</span>
        </div>
        <div class="position-info">
          <span class="position-profit ${isProfit ? 'positive' : 'negative'}">
            ${isProfit ? '+' : ''}${position.profit.toFixed(2)} USD
          </span>
          <button class="position-close" data-ticket="${position.ticket}">Close</button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Add event listeners to close buttons
  document.querySelectorAll('.position-close').forEach(button => {
    button.addEventListener('click', (e) => {
      const ticket = e.target.getAttribute('data-ticket');
      closePosition(ticket);
    });
  });
}

// Close a specific position
function closePosition(ticket) {
  if (!isConnectedToMT5) {
    showNotification('Not connected to MT5', 'error');
    return;
  }
  
  const position = activePositions.find(p => p.ticket.toString() === ticket);
  if (!position) return;
  
  fetch(`${serverUrl}/close_positions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ symbol: position.symbol }),
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification(`Closed position for ${position.symbol}`, 'success');
        // Update positions
        updatePositions();
      } else {
        showNotification(`Error closing position: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      console.error("Error closing position:", error);
      showNotification('Error closing position', 'error');
    });
}

// Close all positions
function closeAllPositions() {
  if (!isConnectedToMT5) {
    showNotification('Not connected to MT5', 'error');
    return;
  }
  
  fetch(`${serverUrl}/close_positions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification(`Closed ${data.closed_count} positions`, 'success');
        // Update positions
        updatePositions();
      } else {
        showNotification(`Error closing positions: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      console.error("Error closing positions:", error);
      showNotification('Error closing positions', 'error');
    });
}

// Calculate technical indicators and check for trade signals
function calculateIndicatorsAndTriggerTrades(symbol) {
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
        
        executeTrade("buy", symbol, settings.lotSizePerTrade, stopLoss, takeProfit);
        
        // Update last trade time and widget
        lastTradeTime = currentTime;
        document.getElementById('last-signal').textContent = 'BUY';
        incrementTradeCounter();
      }
      // Short condition: shortMA crosses below longMA and price is below EMA200
      else if (currentCrossoverState === -1 && currentPrice < ema200) {
        const stopLoss = currentPrice + atrValue;
        const takeProfit = currentPrice - (atrValue * 2); // 1:2 risk-reward ratio
        
        executeTrade("sell", symbol, settings.lotSizePerTrade, stopLoss, takeProfit);
        
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
    // We could add more information here if needed
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

// Execute a trade using the MT5 server
function executeTrade(direction, symbol = "EURUSD", lotSize = null, stopLoss = null, takeProfit = null) {
  if (!isConnectedToMT5) {
    showNotification('Not connected to MT5', 'error');
    return;
  }
  
  // Use settings lot size if not specified
  if (lotSize === null && settings) {
    lotSize = settings.lotSizePerTrade;
  }
  
  // Check pyramiding settings
  if (settings && !settings.enablePyramiding) {
    // Check if we already have a position for this symbol
    const existingPositions = activePositions.filter(p => p.symbol === symbol);
    if (existingPositions.length > 0) {
      showNotification('Position already exists and pyramiding is disabled', 'error');
      return;
    }
  } else if (settings && settings.enablePyramiding) {
    // Check if we've reached the maximum number of positions
    const existingPositions = activePositions.filter(p => p.symbol === symbol);
    if (existingPositions.length >= settings.maxPyramidPositions) {
      showNotification(`Maximum pyramid positions (${settings.maxPyramidPositions}) reached`, 'error');
      return;
    }
  }
  
  // Prepare trade request
  const tradeRequest = {
    direction: direction,
    symbol: symbol,
    lotSize: lotSize
  };
  
  if (stopLoss !== null) {
    tradeRequest.stopLoss = stopLoss;
  }
  
  if (takeProfit !== null) {
    tradeRequest.takeProfit = takeProfit;
  }
  
  // Execute trade via server
  fetch(`${serverUrl}/trade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tradeRequest),
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showTradeNotification(direction, {
          price: data.price,
          lotSize: lotSize,
          symbol: symbol,
          stopLoss: stopLoss,
          takeProfit: takeProfit
        });
        
        // Update positions after successful trade
        setTimeout(updatePositions, 1000);
      } else {
        showNotification(`Trade failed: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      console.error("Error executing trade:", error);
      showNotification('Error executing trade', 'error');
    });
}

// Show a notification for the trade signal
function showTradeNotification(direction, details)

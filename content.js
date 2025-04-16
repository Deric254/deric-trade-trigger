// Variables to store state and settings
let isEnabled = false;
let settings = {};
let priceData = [];
let lastSignalTime = 0;
let isMT5Detected = false;

// Check if we're on an MT5 platform
function checkForMT5() {
  // Common selectors or elements found in MT5 web platforms
  const mt5Indicators = [
    '.chart-page', // MetaTrader Web Terminal
    '#terminal-container', // MT5 Web Platform
    '.xmc__trading-platform', // XM MT5 WebTrader
    '.trading-platform-container' // Generic container
  ];
  
  for (const selector of mt5Indicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  // Check for MT5-specific title patterns
  const title = document.title.toLowerCase();
  if (title.includes('metatrader') || title.includes('mt5') || title.includes('trading terminal')) {
    return true;
  }
  
  return false;
}

// Initialize when the content script loads
function initialize() {
  // Check if we're on an MT5 platform
  isMT5Detected = checkForMT5();
  
  if (!isMT5Detected) {
    console.log('Deric MT5 Trade Trigger: MT5 platform not detected on this page.');
    return;
  }
  
  console.log('Deric MT5 Trade Trigger: MT5 platform detected!');
  
  // Send message to background script to get current state
  chrome.runtime.sendMessage({ action: "getState" }, (response) => {
    isEnabled = response.isEnabled;
  });
  
  // Load settings from storage
  chrome.storage.local.get(["settings"], (result) => {
    settings = result.settings || getDefaultSettings();
  });
  
  // Start observing DOM changes to detect chart updates
  setupObserver();
  
  // Setup price data collection (if available on the page)
  setupPriceDataCollection();
  
  // Add UI notification to indicate the extension is active
  addNotification();
}

// Default settings in case storage fails
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

// Setup MutationObserver to watch for chart changes
function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    // If the extension is disabled, don't process changes
    if (!isEnabled) return;
    
    // Process DOM changes to detect chart updates
    // This is a simplified example - actual implementation would be more complex
    // and specific to the MT5 web platform's DOM structure
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Check for price data updates on chart
        collectPriceData();
      }
    });
  });
  
  // Target node is the chart container - this would need to be adjusted for specific MT5 platforms
  const targetNodes = [
    '.chart-container',
    '#chart-container',
    '.trading-chart',
    // Add more potential selectors based on MT5 web platforms
  ];
  
  for (const selector of targetNodes) {
    const targetNode = document.querySelector(selector);
    if (targetNode) {
      observer.observe(targetNode, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        characterData: true 
      });
      console.log(`Deric MT5 Trade Trigger: Observing ${selector}`);
      break;
    }
  }
}

// Collect price data from the MT5 chart (simplified)
function collectPriceData() {
  // This is a placeholder - actual implementation would depend on how 
  // to access price data from the MT5 web platform, which may require
  // more complex DOM interactions or request interception
  console.log('Attempting to collect price data');
  
  // If we can access price data from the page, we would add it to our array
  // For now, we'll use simulated data for demonstration
  simulatePriceData();
}

// Setup price data collection intervals
function setupPriceDataCollection() {
  // Set up an interval to collect data regularly
  setInterval(() => {
    if (isEnabled) {
      collectPriceData();
    }
  }, 5000); // Check every 5 seconds
}

// For demo purposes - simulates getting price data
function simulatePriceData() {
  // In a real implementation, you would extract actual price data from the MT5 DOM
  // or use an API if available
  
  // For simulation, we'll add a random tick to the last price
  if (priceData.length === 0) {
    // Start with a random price around 1.1000 (like EURUSD)
    priceData.push({
      timestamp: Date.now(),
      open: 1.1000 + (Math.random() * 0.01 - 0.005),
      high: 1.1005 + (Math.random() * 0.01 - 0.005),
      low: 0.9995 + (Math.random() * 0.01 - 0.005),
      close: 1.1000 + (Math.random() * 0.01 - 0.005),
      volume: Math.floor(Math.random() * 1000) + 100
    });
  } else {
    const lastPrice = priceData[priceData.length - 1].close;
    const change = (Math.random() * 0.002 - 0.001); // Small random change
    const newClose = lastPrice + change;
    
    priceData.push({
      timestamp: Date.now(),
      open: lastPrice,
      high: Math.max(lastPrice, newClose) + (Math.random() * 0.0005),
      low: Math.min(lastPrice, newClose) - (Math.random() * 0.0005),
      close: newClose,
      volume: Math.floor(Math.random() * 1000) + 100
    });
  }
  
  // Keep only the last 300 price points (enough for our calculations)
  if (priceData.length > 300) {
    priceData = priceData.slice(-300);
  }
  
  // Process the updated data
  processData();
}

// Process the collected price data to generate signals
function processData() {
  if (priceData.length < Math.max(settings.shortMAPeriod, settings.longMAPeriod, settings.emaPeriod)) {
    // Not enough data yet
    return;
  }
  
  // Extract closing prices
  const closePrices = priceData.map(candle => candle.close);
  const volumes = priceData.map(candle => candle.volume);
  
  // Calculate the indicators
  const shortMA = calculateSMA(closePrices, settings.shortMAPeriod);
  const longMA = calculateSMA(closePrices, settings.longMAPeriod);
  const ema200 = calculateEMA(closePrices, settings.emaPeriod);
  
  // Calculate ATR
  const atrValue = calculateATR(priceData, settings.atrLength);
  
  // Calculate average volume
  const avgVolume = calculateSMA(volumes, 20);
  
  // Get the current values
  const currentCandle = priceData[priceData.length - 1];
  const previousCandle = priceData[priceData.length - 2];
  
  if (!currentCandle || !previousCandle) return;
  
  const currentClose = currentCandle.close;
  const currentVolume = currentCandle.volume;
  
  // Previous indicator values
  const prevShortMA = shortMA[shortMA.length - 2];
  const prevLongMA = longMA[longMA.length - 2];
  
  // Current indicator values
  const currShortMA = shortMA[shortMA.length - 1];
  const currLongMA = longMA[longMA.length - 1];
  const currEMA200 = ema200[ema200.length - 1];
  
  // Check for crossover conditions
  const crossedAbove = prevShortMA < prevLongMA && currShortMA > currLongMA;
  const crossedBelow = prevShortMA > prevLongMA && currShortMA < currLongMA;
  
  // Calculate stop loss and take profit levels
  const stopLossDistance = atrValue[atrValue.length - 1]; // 1 ATR
  const takeProfitDistance = stopLossDistance * 10; // 10:1 risk-reward
  
  // Filter conditions
  const above200EMA = currentClose > currEMA200;
  const below200EMA = currentClose < currEMA200;
  const volumeCondition = currentVolume > avgVolume[avgVolume.length - 1];
  
  // Low volatility filter
  const avgATR = calculateSMA(atrValue, 20);
  const lowVolatilityCondition = atrValue[atrValue.length - 1] > avgATR[avgATR.length - 1];
  
  // Risk-reward ratio filter
  const favorableRiskReward = takeProfitDistance / stopLossDistance >= 2;
  
  // Cooldown check
  const currentTime = Date.now();
  const cooldownInMs = settings.cooldownPeriod * 60 * 1000; // Convert bars to ms (assuming 1 bar = 1 minute)
  const tradeCooldown = (currentTime - lastSignalTime) >= cooldownInMs;
  
  // Check for buy signal
  if (crossedAbove && above200EMA && volumeCondition && lowVolatilityCondition && favorableRiskReward && tradeCooldown) {
    // Generate buy signal
    const signal = {
      type: "BUY",
      price: currentClose,
      timestamp: currentTime,
      symbol: getSymbolFromPage() || "Unknown",
      stopLoss: currentClose - stopLossDistance,
      takeProfit: currentClose + takeProfitDistance
    };
    
    // Store the signal
    saveSignal(signal);
    
    // Trigger the trade (in a real implementation)
    triggerTrade(signal);
    
    // Update last signal time
    lastSignalTime = currentTime;
  }
  
  // Check for sell signal
  if (crossedBelow && below200EMA && volumeCondition && lowVolatilityCondition && favorableRiskReward && tradeCooldown) {
    // Generate sell signal
    const signal = {
      type: "SELL",
      price: currentClose,
      timestamp: currentTime,
      symbol: getSymbolFromPage() || "Unknown",
      stopLoss: currentClose + stopLossDistance,
      takeProfit: currentClose - takeProfitDistance
    };
    
    // Store the signal
    saveSignal(signal);
    
    // Trigger the trade (in a real implementation)
    triggerTrade(signal);
    
    // Update last signal time
    lastSignalTime = currentTime;
  }
}

// Trigger a trade in MT5 (this would need to be customized for the specific MT5 web platform)
function triggerTrade(signal) {
  console.log(`Deric MT5 Trade Trigger: ${signal.type} signal generated at ${signal.price}`);
  
  // Display a notification to the user
  showTradeNotification(signal);
  
  // Here you would interact with the MT5 web platform DOM to place the trade
  // This is highly platform-specific and would require knowledge of the
  // specific platform's DOM structure and interactivity
  
  // Example (simplified):
  try {
    // Find and click the "New Order" button (selector would vary by platform)
    const newOrderButton = document.querySelector('.new-order-btn, .order-button, #place-order');
    if (newOrderButton) {
      newOrderButton.click();
      
      // Wait for order dialog to open
      setTimeout(() => {
        // Set order type (buy/sell)
        const buyButton = document.querySelector('.buy-button, .btn-buy, #btn-buy');
        const sellButton = document.querySelector('.sell-button, .btn-sell, #btn-sell');
        
        if (signal.type === 'BUY' && buyButton) {
          buyButton.click();
        } else if (signal.type === 'SELL' && sellButton) {
          sellButton.click();
        }
        
        // Set lot size
        const lotSizeInput = document.querySelector('.lot-size-input, #volume, #lot-size');
        if (lotSizeInput) {
          lotSizeInput.value = settings.lotSizePerTrade;
          // Trigger change event
          lotSizeInput.dispatchEvent(new Event('change'));
        }
        
        // Set stop loss
        const slInput = document.querySelector('.sl-input, #stop-loss, #sl');
        if (slInput) {
          slInput.value = signal.stopLoss.toFixed(5);
          slInput.dispatchEvent(new Event('change'));
        }
        
        // Set take profit
        const tpInput = document.querySelector('.tp-input, #take-profit, #tp');
        if (tpInput) {
          tpInput.value = signal.takeProfit.toFixed(5);
          tpInput.dispatchEvent(new Event('change'));
        }
        
        // Submit order
        const submitButton = document.querySelector('.submit-button, .place-order-btn, #place-order-btn');
        if (submitButton) {
          submitButton.click();
        }
      }, 500);
    }
  } catch (error) {
    console.error('Deric MT5 Trade Trigger: Error placing trade', error);
  }
}

// Save signal to storage
function saveSignal(signal) {
  chrome.storage.local.get(["signals"], (result) => {
    let signals = result.signals || [];
    signals.push(signal);
    
    // Keep only the last 100 signals
    if (signals.length > 100) {
      signals = signals.slice(-100);
    }
    
    chrome.storage.local.set({ signals });
    
    // Notify the popup about new signal
    chrome.runtime.sendMessage({ action: "newSignal" });
  });
}

// Technical Indicators Calculation Functions
function calculateSMA(data, period) {
  const sma = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    
    sma.push(sum / period);
  }
  
  return sma;
}

function calculateEMA(data, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  
  ema.push(sum / period);
  
  // Calculate EMA values
  for (let i = period; i < data.length; i++) {
    const currentValue = data[i];
    const previousEMA = ema[i - period];
    
    const currentEMA = (currentValue - previousEMA) * multiplier + previousEMA;
    ema.push(currentEMA);
  }
  
  return ema;
}

function calculateATR(data, period) {
  const trueRanges = [];
  const atr = [];
  
  // Calculate True Range for each candle
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      // First candle - use high - low
      trueRanges.push(data[i].high - data[i].low);
    } else {
      // Calculate the three differences
      const highLowDiff = data[i].high - data[i].low;
      const highCloseDiff = Math.abs(data[i].high - data[i-1].close);
      const lowCloseDiff = Math.abs(data[i].low - data[i-1].close);
      
      // True Range is the max of these three
      trueRanges.push(Math.max(highLowDiff, highCloseDiff, lowCloseDiff));
    }
  }
  
  // Calculate ATR using SMA initially
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      atr.push(null);
      continue;
    }
    
    if (i === period - 1) {
      // First ATR value is simple average of TR
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += trueRanges[i - j];
      }
      atr.push(sum / period);
    } else {
      // Subsequent ATR values using the smoothing formula
      const previousATR = atr[atr.length - 1];
      const currentTR = trueRanges[i];
      atr.push((previousATR * (period - 1) + currentTR) / period);
    }
  }
  
  return atr;
}

// Try to extract the current symbol from the page
function getSymbolFromPage() {
  // This would need to be adapted to the specific MT5 web platform
  const symbolElements = [
    '.symbol-name',
    '.instrument-name',
    '#symbol-name',
    '.chart-title'
  ];
  
  for (const selector of symbolElements) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      return element.textContent.trim();
    }
  }
  
  return null;
}

// Add notification to the page to show the extension is active
function addNotification() {
  const notificationDiv = document.createElement('div');
  notificationDiv.id = 'deric-trade-trigger-notification';
  notificationDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background-color: rgba(33, 150, 243, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 9999;
    cursor: pointer;
    transition: opacity 0.3s;
  `;
  
  notificationDiv.textContent = 'Deric Trade Trigger Active';
  notificationDiv.title = 'Click to hide';
  
  notificationDiv.addEventListener('click', () => {
    notificationDiv.style.opacity = '0';
    setTimeout(() => {
      notificationDiv.remove();
    }, 300);
  });
  
  document.body.appendChild(notificationDiv);
}

// Display trade notification on the page
function showTradeNotification(signal) {
  const notificationDiv = document.createElement('div');
  notificationDiv.style.cssText = `
    position: fixed;
    top: 70px;
    right: 10px;
    background-color: ${signal.type === 'BUY' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
    color: white;
    padding: 15px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transition: all 0.3s;
  `;
  
  notificationDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">${signal.type} Signal Generated</div>
    <div>Price: ${signal.price.toFixed(5)}</div>
    <div>Stop Loss: ${signal.stopLoss.toFixed(5)}</div>
    <div>Take Profit: ${signal.takeProfit.toFixed(5)}</div>
    <div style="font-size: 12px; margin-top: 5px;">${new Date(signal.timestamp).toLocaleTimeString()}</div>
  `;
  
  document.body.appendChild(notificationDiv);
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    notificationDiv.style.opacity = '0';
    notificationDiv.style.transform = 'translateX(100px)';
    setTimeout(() => {
      notificationDiv.remove();
    }, 300);
  }, 5000);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "stateChanged") {
    isEnabled = message.isEnabled;
    console.log(`Deric MT5 Trade Trigger: Extension ${isEnabled ? 'enabled' : 'disabled'}`);
  } else if (message.action === "settingsChanged") {
    settings = message.settings;
    console.log('Deric MT5 Trade Trigger: Settings updated', settings);
  }
});

// Start the extension
initialize();

// Re-check for MT5 platform every 5 seconds in case it loads after our content script
if (!isMT5Detected) {
  const checkInterval = setInterval(() => {
    if (checkForMT5()) {
      console.log('Deric MT5 Trade Trigger: MT5 platform detected after page load!');
      clearInterval(checkInterval);
      initialize();
    }
  }, 5000);
}

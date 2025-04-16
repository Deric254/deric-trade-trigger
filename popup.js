
document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const statusText = document.getElementById('statusText');
  const settingsForm = document.getElementById('settingsForm');
  const signalsContainer = document.getElementById('signalsContainer');
  
  // Input fields
  const shortMAPeriod = document.getElementById('shortMAPeriod');
  const longMAPeriod = document.getElementById('longMAPeriod');
  const emaPeriod = document.getElementById('emaPeriod');
  const accountSize = document.getElementById('accountSize');
  const riskPerTrade = document.getElementById('riskPerTrade');
  const lotSizePerTrade = document.getElementById('lotSizePerTrade');
  const atrLength = document.getElementById('atrLength');
  const cooldownPeriod = document.getElementById('cooldownPeriod');
  
  // Initialize the UI with the current state
  chrome.runtime.sendMessage({ action: "getState" }, (response) => {
    enableToggle.checked = response.isEnabled;
    statusText.textContent = response.isEnabled ? "Enabled" : "Disabled";
    statusText.style.color = response.isEnabled ? "#4caf50" : "#f44336";
  });
  
  // Load settings from storage
  chrome.storage.local.get(["settings", "signals"], (result) => {
    const settings = result.settings || {};
    
    // Populate form fields with saved settings
    shortMAPeriod.value = settings.shortMAPeriod || 15;
    longMAPeriod.value = settings.longMAPeriod || 100;
    emaPeriod.value = settings.emaPeriod || 200;
    accountSize.value = settings.accountSize || 5000;
    riskPerTrade.value = settings.riskPerTrade || 20;
    lotSizePerTrade.value = settings.lotSizePerTrade || 1.0;
    atrLength.value = settings.atrLength || 14;
    cooldownPeriod.value = settings.cooldownPeriod || 10;
    
    // Display signals if any exist
    if (result.signals && result.signals.length > 0) {
      displaySignals(result.signals);
    }
  });
  
  // Handle toggle click
  enableToggle.addEventListener('change', () => {
    const isEnabled = enableToggle.checked;
    statusText.textContent = isEnabled ? "Enabled" : "Disabled";
    statusText.style.color = isEnabled ? "#4caf50" : "#f44336";
    
    // Send message to background script
    chrome.runtime.sendMessage({ 
      action: "toggleEnabled", 
      value: isEnabled 
    });
  });
  
  // Handle settings form submit
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Collect settings from form
    const settings = {
      shortMAPeriod: parseInt(shortMAPeriod.value),
      longMAPeriod: parseInt(longMAPeriod.value),
      emaPeriod: parseInt(emaPeriod.value),
      accountSize: parseInt(accountSize.value),
      riskPerTrade: parseInt(riskPerTrade.value),
      lotSizePerTrade: parseFloat(lotSizePerTrade.value),
      atrLength: parseInt(atrLength.value),
      cooldownPeriod: parseInt(cooldownPeriod.value)
    };
    
    // Save settings
    chrome.runtime.sendMessage({ 
      action: "saveSettings", 
      settings 
    }, (response) => {
      if (response.success) {
        // Briefly show "Saved" message
        const button = document.getElementById('saveSettings');
        const originalText = button.textContent;
        button.textContent = "Saved!";
        button.disabled = true;
        
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1500);
      }
    });
  });
  
  // Listen for new signals
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "newSignal") {
      chrome.storage.local.get(["signals"], (result) => {
        const signals = result.signals || [];
        displaySignals(signals);
      });
    }
  });
  
  // Function to display signals
  function displaySignals(signals) {
    signalsContainer.innerHTML = "";
    
    if (signals.length === 0) {
      signalsContainer.innerHTML = `<p class="no-signals">No signals generated yet.</p>`;
      return;
    }
    
    // Display the most recent 10 signals
    const recentSignals = signals.slice(-10).reverse();
    
    recentSignals.forEach(signal => {
      const signalElement = document.createElement('div');
      signalElement.className = `signal-item signal-${signal.type.toLowerCase()}`;
      
      const date = new Date(signal.timestamp);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      signalElement.innerHTML = `
        <strong>${signal.type}</strong> @ ${signal.price.toFixed(5)}
        <br>
        <small>${formattedDate} - ${signal.symbol}</small>
      `;
      
      signalsContainer.appendChild(signalElement);
    });
  }
});

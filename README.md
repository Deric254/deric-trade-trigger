
# MT5 Trade Trigger Extension

This Chrome extension automatically triggers trades in MetaTrader 5 based on a simple moving average crossover strategy.

## Setup Instructions

### Prerequisites
- MetaTrader 5 installed on your computer
- Python 3.7+ installed
- Chrome browser

### Python Setup
1. Install the required Python packages:
   ```
   pip install MetaTrader5 
   ```

2. Run the MT5 server script:
   ```
   python mt5_server.py
   ```
   This will start a local server on port 5555 that connects to your MetaTrader 5 terminal.

3. Make sure MetaTrader 5 is running and logged in to your trading account.

### Extension Installation
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the extension folder
4. The extension should now appear in your Chrome toolbar

## Usage
1. Click on the extension icon to open the settings popup
2. Configure your trading parameters
3. Toggle the switch to enable automated trading
4. When on MT5-related sites, the floating widget will appear for quick controls

## Features
- Moving average crossover strategy with EMA filter
- Automatic trade execution with stop loss and take profit
- Position pyramiding option
- Ability to customize indicators and risk parameters
- Real-time connection status indicator

## Troubleshooting
- If the extension shows "Not connected to MT5", make sure the Python server is running
- Check that MetaTrader 5 is open and logged in
- Verify that no firewall is blocking the connection

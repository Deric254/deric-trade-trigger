
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

2. **Auto-start Configuration (Optional):**
   For the auto-start feature to work, you need to set up native messaging:
   
   a. Create a native messaging host manifest file:
   - Windows: Create `com.mt5.trade.trigger.json` in `%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts\`
   - Mac: Create `com.mt5.trade.trigger.json` in `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
   - Linux: Create `com.mt5.trade.trigger.json` in `~/.config/google-chrome/NativeMessagingHosts/`

   b. The file should contain:
   ```json
   {
     "name": "com.mt5.trade.trigger",
     "description": "MT5 Trade Trigger Native Messaging Host",
     "path": "[FULL_PATH_TO_STARTER_SCRIPT]",
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://[YOUR_EXTENSION_ID]/"
     ]
   }
   ```
   Replace `[FULL_PATH_TO_STARTER_SCRIPT]` with the full path to a script that launches `mt5_server.py`.
   Replace `[YOUR_EXTENSION_ID]` with your extension's ID (shown in chrome://extensions).

3. If auto-start fails, run the MT5 server script manually:
   ```
   python mt5_server.py
   ```
   This will start a local server on port 5555 that connects to your MetaTrader 5 terminal.

4. Make sure MetaTrader 5 is running and logged in to your trading account.

### Extension Installation
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the extension folder
4. The extension should now appear in your Chrome toolbar

## Usage
1. Click on the extension icon to open the settings popup
2. Configure your trading parameters including trading pairs
3. Toggle the switch to enable automated trading
4. When on MT5-related sites, the floating widget will appear for quick controls

## Features
- Moving average crossover strategy with EMA filter
- Automatic trade execution with stop loss and take profit
- Position pyramiding option
- Support for multiple currency pairs
- Trade statistics tracking
- Ability to customize indicators and risk parameters
- Real-time connection status indicator
- Auto-start Python server option

## Troubleshooting
- If the extension shows "Not connected to MT5", make sure the Python server is running
- Check that MetaTrader 5 is open and logged in
- Verify that no firewall is blocking the connection
- For auto-start issues, check your native messaging host configuration

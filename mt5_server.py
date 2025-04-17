
import http.server
import socketserver
import json
import time
import threading
import datetime
from urllib.parse import parse_qs, urlparse
import MetaTrader5 as mt5

# Global variables
is_connected = False
last_prices = {}
active_positions = []
server_running = True
trade_history = []

# Initialize connection to MT5
def connect_to_mt5():
    global is_connected
    try:
        # Initialize MT5 connection
        if not mt5.initialize():
            print(f"MT5 initialization failed. Error code: {mt5.last_error()}")
            is_connected = False
            return False
        
        print("Connected to MetaTrader 5")
        is_connected = True
        return True
    except Exception as e:
        print(f"Error connecting to MT5: {e}")
        is_connected = False
        return False

# Function to get current price for a symbol
def get_price(symbol="EURUSD"):
    if not is_connected:
        return None
    
    try:
        # Get last price
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return None
        
        return {
            "ask": tick.ask,
            "bid": tick.bid,
            "time": tick.time
        }
    except Exception as e:
        print(f"Error getting price for {symbol}: {e}")
        return None

# Function to get historical data for backtesting
def get_historical_data(symbol, timeframe, start_pos, count):
    if not is_connected:
        return None
    
    try:
        # Convert timeframe string to MT5 timeframe
        tf_map = {
            "M1": mt5.TIMEFRAME_M1,
            "M5": mt5.TIMEFRAME_M5,
            "M15": mt5.TIMEFRAME_M15,
            "M30": mt5.TIMEFRAME_M30,
            "H1": mt5.TIMEFRAME_H1,
            "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1,
            "W1": mt5.TIMEFRAME_W1,
            "MN1": mt5.TIMEFRAME_MN1
        }
        
        tf = tf_map.get(timeframe, mt5.TIMEFRAME_H1)
        
        # Get rates
        rates = mt5.copy_rates_from_pos(symbol, tf, start_pos, count)
        
        if rates is None or len(rates) == 0:
            return None
        
        # Convert to list of dictionaries
        result = []
        for rate in rates:
            result.append({
                "time": rate[0],
                "open": rate[1],
                "high": rate[2],
                "low": rate[3],
                "close": rate[4],
                "volume": rate[5],
                "spread": rate[6],
                "real_volume": rate[7]
            })
        
        return result
    except Exception as e:
        print(f"Error getting historical data for {symbol}: {e}")
        return None

# Function to execute trade
def execute_trade(direction, symbol, lot_size, stop_loss=None, take_profit=None):
    if not is_connected:
        return {"success": False, "message": "Not connected to MT5"}
    
    try:
        # Check if symbol exists in MT5
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            return {"success": False, "message": f"Symbol {symbol} not found in MT5"}
        
        # Make sure symbol is selected in Market Watch to get data
        if not symbol_info.visible:
            print(f"Symbol {symbol} not visible, trying to select")
            mt5.symbol_select(symbol, True)
        
        # Prepare trade request
        trade_type = mt5.ORDER_TYPE_BUY if direction == "buy" else mt5.ORDER_TYPE_SELL
        price = mt5.symbol_info_tick(symbol).ask if direction == "buy" else mt5.symbol_info_tick(symbol).bid
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(lot_size),
            "type": trade_type,
            "price": price,
            "deviation": 10,
            "magic": 123456,
            "comment": "Python MT5 Trade Trigger",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        if stop_loss is not None:
            request["sl"] = float(stop_loss)
        if take_profit is not None:
            request["tp"] = float(take_profit)
            
        # Execute trade
        result = mt5.order_send(request)
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "message": f"Order failed, return code: {result.retcode}"
            }
        
        # Record trade in history
        trade_record = {
            "timestamp": time.time(),
            "symbol": symbol,
            "direction": direction,
            "volume": result.volume,
            "price": result.price,
            "order_id": result.order,
            "sl": stop_loss,
            "tp": take_profit
        }
        trade_history.append(trade_record)
        
        return {
            "success": True,
            "message": "Order executed successfully",
            "order_id": result.order,
            "volume": result.volume,
            "price": result.price,
            "symbol": symbol
        }
    except Exception as e:
        print(f"Error executing trade: {e}")
        return {"success": False, "message": str(e)}

# Function to close all positions for a symbol
def close_positions(symbol=None):
    if not is_connected:
        return {"success": False, "message": "Not connected to MT5"}
    
    try:
        # Get all open positions
        positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
        
        if positions is None:
            return {"success": True, "message": "No positions to close"}
        
        closed_count = 0
        closed_positions = []
        
        # Close each position
        for position in positions:
            # Order type is reversed for closing
            order_type = mt5.ORDER_TYPE_SELL if position.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
            
            # Prepare close request
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": position.symbol,
                "volume": position.volume,
                "type": order_type,
                "position": position.ticket,
                "price": mt5.symbol_info_tick(position.symbol).ask if order_type == mt5.ORDER_TYPE_BUY else mt5.symbol_info_tick(position.symbol).bid,
                "deviation": 10,
                "magic": 123456,
                "comment": "Python MT5 Trade Trigger - Close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            # Execute close position
            result = mt5.order_send(request)
            
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                closed_count += 1
                closed_positions.append({
                    "symbol": position.symbol,
                    "profit": position.profit,
                    "volume": position.volume,
                    "order_id": position.ticket
                })
        
        return {
            "success": True,
            "message": f"Closed {closed_count} positions",
            "closed_count": closed_count,
            "positions": closed_positions
        }
    except Exception as e:
        print(f"Error closing positions: {e}")
        return {"success": False, "message": str(e)}

# Get active positions
def get_positions():
    if not is_connected:
        return []
    
    try:
        positions = mt5.positions_get()
        
        if positions is None or len(positions) == 0:
            return []
        
        position_data = []
        for position in positions:
            position_data.append({
                "ticket": position.ticket,
                "symbol": position.symbol,
                "type": "buy" if position.type == mt5.ORDER_TYPE_BUY else "sell",
                "volume": position.volume,
                "open_price": position.price_open,
                "current_price": position.price_current,
                "profit": position.profit,
                "sl": position.sl,
                "tp": position.tp
            })
        
        return position_data
    except Exception as e:
        print(f"Error getting positions: {e}")
        return []

# Get available symbols
def get_symbols():
    if not is_connected:
        return []
    
    try:
        symbols = mt5.symbols_get()
        
        if symbols is None or len(symbols) == 0:
            return []
        
        symbols_list = []
        for symbol in symbols:
            # Only include symbols that are actually tradable
            if symbol.trade_mode != mt5.SYMBOL_TRADE_MODE_DISABLED:
                symbols_list.append({
                    "name": symbol.name,
                    "currency_base": symbol.currency_base,
                    "currency_profit": symbol.currency_profit,
                    "description": symbol.description
                })
        
        return symbols_list
    except Exception as e:
        print(f"Error getting symbols: {e}")
        return []

# Background task to update prices and positions
def background_updates():
    global last_prices, active_positions, server_running
    
    # Get default symbols to track
    default_symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"]
    tracked_symbols = set(default_symbols)
    
    while server_running:
        # If connected to MT5, update price information
        if is_connected:
            # Get any new symbols from active positions
            positions = get_positions()
            
            if positions:
                for position in positions:
                    tracked_symbols.add(position["symbol"])
            
            # Update prices for all tracked symbols
            for symbol in tracked_symbols:
                price = get_price(symbol)
                if price:
                    last_prices[symbol] = price
            
            # Update positions
            active_positions = positions
        
        # Sleep for 1 second
        time.sleep(1)

# Custom HTTP request handler
class MT5RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Define CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # Handle various API endpoints
        if path == "/status":
            response = {"connected": is_connected}
            self.wfile.write(json.dumps(response).encode())
        
        elif path == "/prices":
            self.wfile.write(json.dumps(last_prices).encode())
        
        elif path == "/positions":
            self.wfile.write(json.dumps(active_positions).encode())
        
        elif path == "/connect":
            success = connect_to_mt5()
            response = {"success": success, "connected": is_connected}
            self.wfile.write(json.dumps(response).encode())
        
        elif path == "/disconnect":
            if is_connected:
                mt5.shutdown()
                is_connected = False
            response = {"success": True, "connected": False}
            self.wfile.write(json.dumps(response).encode())
        
        elif path == "/symbols":
            symbols = get_symbols()
            response = {"symbols": symbols}
            self.wfile.write(json.dumps(response).encode())
        
        elif path == "/history":
            # Parse query parameters for historical data
            query = parse_qs(parsed_url.query)
            symbol = query.get("symbol", ["EURUSD"])[0]
            timeframe = query.get("timeframe", ["H1"])[0]
            start_pos = int(query.get("start_pos", [0])[0])
            count = int(query.get("count", [100])[0])
            
            historical_data = get_historical_data(symbol, timeframe, start_pos, count)
            
            if historical_data:
                response = {"success": True, "data": historical_data}
            else:
                response = {"success": False, "message": "Failed to get historical data"}
            
            self.wfile.write(json.dumps(response).encode())
        
        elif path == "/trade_history":
            response = {"history": trade_history}
            self.wfile.write(json.dumps(response).encode())
        
        else:
            response = {"error": "Unknown endpoint"}
            self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Read and parse request body
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        request_data = json.loads(post_data.decode('utf-8'))
        
        # Define CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # Handle various API endpoints
        if path == "/trade":
            direction = request_data.get("direction")
            symbol = request_data.get("symbol", "EURUSD")
            lot_size = request_data.get("lotSize", 0.01)
            stop_loss = request_data.get("stopLoss")
            take_profit = request_data.get("takeProfit")
            
            result = execute_trade(direction, symbol, lot_size, stop_loss, take_profit)
            self.wfile.write(json.dumps(result).encode())
        
        elif path == "/close_positions":
            symbol = request_data.get("symbol")
            result = close_positions(symbol)
            self.wfile.write(json.dumps(result).encode())
        
        else:
            response = {"error": "Unknown endpoint"}
            self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# Print server info
def print_server_info():
    print("MT5 Trade Trigger Server")
    print("======================")
    print(f"Server URL: http://localhost:5555")
    print("Available endpoints:")
    print("  /status         - Get MT5 connection status")
    print("  /connect        - Connect to MT5")
    print("  /disconnect     - Disconnect from MT5")
    print("  /prices         - Get current prices for tracked symbols")
    print("  /positions      - Get active positions")
    print("  /symbols        - Get available trading symbols")
    print("  /trade          - Execute a trade (POST)")
    print("  /close_positions - Close positions (POST)")
    print("  /history        - Get historical data for backtesting")
    print("  /trade_history  - Get trade execution history")
    print("\nPress Ctrl+C to stop the server")
    print("======================")

# Start HTTP server
def start_server(port=5555):
    try:
        handler = MT5RequestHandler
        server = socketserver.ThreadingTCPServer(("localhost", port), handler)
        print_server_info()
        
        # Start background thread for updates
        update_thread = threading.Thread(target=background_updates)
        update_thread.daemon = True
        update_thread.start()
        
        # Start server
        server.serve_forever()
    except KeyboardInterrupt:
        global server_running
        server_running = False
        print("\nServer stopped")
    except Exception as e:
        print(f"Error starting server: {e}")

# Run the server with automatic connection attempt
if __name__ == "__main__":
    # Try to connect to MT5
    connect_to_mt5()
    
    # Start HTTP server
    start_server()

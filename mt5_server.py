
import http.server
import socketserver
import json
import time
import threading
from urllib.parse import parse_qs, urlparse
import MetaTrader5 as mt5

# Global variables
is_connected = False
last_prices = {}
active_positions = []
server_running = True

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
        print(f"Error getting price: {e}")
        return None

# Function to execute trade
def execute_trade(direction, symbol, lot_size, stop_loss=None, take_profit=None):
    if not is_connected:
        return {"success": False, "message": "Not connected to MT5"}
    
    try:
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
        
        return {
            "success": True,
            "message": "Order executed successfully",
            "order_id": result.order,
            "volume": result.volume,
            "price": result.price
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
        
        return {
            "success": True,
            "message": f"Closed {closed_count} positions",
            "closed_count": closed_count
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

# Background task to update prices and positions
def background_updates():
    global last_prices, active_positions, server_running
    
    symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"]
    
    while server_running:
        # Update prices
        for symbol in symbols:
            price = get_price(symbol)
            if price:
                last_prices[symbol] = price
        
        # Update positions
        active_positions = get_positions()
        
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

# Start HTTP server
def start_server(port=5555):
    try:
        handler = MT5RequestHandler
        server = socketserver.ThreadingTCPServer(("localhost", port), handler)
        print(f"Server started at http://localhost:{port}")
        
        # Start background thread for updates
        update_thread = threading.Thread(target=background_updates)
        update_thread.daemon = True
        update_thread.start()
        
        # Start server
        server.serve_forever()
    except KeyboardInterrupt:
        global server_running
        server_running = False
        print("Server stopped")
    except Exception as e:
        print(f"Error starting server: {e}")

# Run the server with automatic connection attempt
if __name__ == "__main__":
    # Try to connect to MT5
    connect_to_mt5()
    
    # Start HTTP server
    start_server()

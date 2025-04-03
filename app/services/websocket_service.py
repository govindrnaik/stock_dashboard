import asyncio
import json
import logging
from typing import Dict, List, Set

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class StockUpdateManager:
    """Manager for handling WebSocket connections and broadcasting stock updates"""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.all_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, symbol: str = None):
        """Connect a new WebSocket client"""
        await websocket.accept()
        self.all_connections.add(websocket)

        # If a specific symbol is provided, add to that symbol's connections
        if symbol:
            if symbol not in self.active_connections:
                self.active_connections[symbol] = []
            self.active_connections[symbol].append(websocket)

        logger.info(
            f"New WebSocket connection. Total connections: {len(self.all_connections)}"
        )

    def disconnect(self, websocket: WebSocket, symbol: str = None):
        """Disconnect a WebSocket client"""
        self.all_connections.discard(websocket)

        # If a specific symbol was being watched, remove from that symbol's connections
        if symbol and symbol in self.active_connections:
            if websocket in self.active_connections[symbol]:
                self.active_connections[symbol].remove(websocket)

            # Clean up empty symbol lists
            if not self.active_connections[symbol]:
                del self.active_connections[symbol]

        logger.info(
            f"WebSocket disconnected. Remaining connections: {len(self.all_connections)}"
        )

    async def broadcast_to_symbol(self, symbol: str, message: dict):
        """Send a message to all clients watching a specific symbol"""
        if symbol in self.active_connections:
            disconnected_websockets = []

            for websocket in self.active_connections[symbol]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    disconnected_websockets.append(websocket)
                    logger.error(f"Error sending to WebSocket: {e}")

            # Clean up any disconnected websockets
            for websocket in disconnected_websockets:
                self.disconnect(websocket, symbol)

    async def broadcast_to_all(self, message: dict):
        """Send a message to all connected clients"""
        disconnected_websockets = []

        for websocket in self.all_connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                disconnected_websockets.append(websocket)
                logger.error(f"Error broadcasting to WebSocket: {e}")

        # Clean up any disconnected websockets
        for websocket in disconnected_websockets:
            self.disconnect(websocket)


# Create a global instance of the manager
stock_update_manager = StockUpdateManager()


# Function to start the background task for simulating stock updates
async def start_stock_update_task():
    """Start a background task to periodically send stock updates"""
    while True:
        try:
            # In a real application, this would fetch real-time data
            # For our demo, we'll simulate some updates for popular stocks
            popular_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]

            import random
            from datetime import datetime

            for symbol in popular_symbols:
                # Skip if no one is watching this symbol
                if (
                    symbol not in stock_update_manager.active_connections
                    and not stock_update_manager.all_connections
                ):
                    continue

                # Generate a random price update (for demo purposes)
                base_price = {
                    "AAPL": 175.50,
                    "MSFT": 405.75,
                    "GOOGL": 152.30,
                    "AMZN": 183.20,
                    "TSLA": 172.40,
                }
                price_change = (
                    random.random() - 0.5
                ) * 2  # Random change between -1 and 1
                new_price = base_price[symbol] + price_change

                # Create update message
                update = {
                    "symbol": symbol,
                    "price": new_price,
                    "change": price_change,
                    "changePercent": (price_change / base_price[symbol]) * 100,
                    "timestamp": datetime.now().isoformat(),
                }

                # Send to symbol-specific watchers
                await stock_update_manager.broadcast_to_symbol(symbol, update)

                # Also send to all connections for general updates
                await stock_update_manager.broadcast_to_all(update)

                # Small delay between symbols
                await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"Error in stock update task: {e}")

        # Wait before sending the next batch of updates
        await asyncio.sleep(5)  # Update every 5 seconds

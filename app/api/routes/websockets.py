from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_service import stock_update_manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for all stock updates"""
    await stock_update_manager.connect(websocket)
    try:
        # Keep the connection alive
        while True:
            # Wait for any messages from the client
            data = await websocket.receive_text()
            # You could process client messages here if needed
    except WebSocketDisconnect:
        stock_update_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        stock_update_manager.disconnect(websocket)


@router.websocket("/ws/{symbol}")
async def websocket_stock_endpoint(websocket: WebSocket, symbol: str):
    """WebSocket endpoint for symbol-specific updates"""
    symbol = symbol.upper()  # Normalize the symbol
    await stock_update_manager.connect(websocket, symbol)
    try:
        # Keep the connection alive
        while True:
            # Wait for any messages from the client
            data = await websocket.receive_text()
            # You could process client messages here if needed
    except WebSocketDisconnect:
        stock_update_manager.disconnect(websocket, symbol)
    except Exception as e:
        print(f"WebSocket error for {symbol}: {e}")
        stock_update_manager.disconnect(websocket, symbol)

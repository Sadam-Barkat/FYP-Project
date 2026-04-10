"""
WebSocket connection manager for real-time updates.

Broadcast event types:
- admin_data_changed: any mutation that should refresh admin dashboards (single event; use `source` for debugging)
- laboratory_updated: lab entry (doctor/lab UIs may still listen)
- patient_discharged: doctor discharged patient
- vitals_updated: nurse recorded vitals
- patients_updated: reception registered/updated patient flow
"""
import asyncio
import json
import logging
from typing import List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)
        logger.info("WebSocket connected, total=%s", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)
        logger.info("WebSocket disconnected, total=%s", len(self._connections))

    async def broadcast(self, message: dict) -> None:
        """Send a JSON message to all connected clients."""
        if not self._connections:
            return
        text = json.dumps(message)
        dead: List[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(text)
            except Exception as e:
                logger.warning("WebSocket send failed: %s", e)
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


# Single global instance for the app
manager = ConnectionManager()


async def broadcast_admin_data_changed(source: str = "unknown") -> None:
    """Tell all connected clients to refetch admin dashboard aggregates and lists."""
    await manager.broadcast({"type": "admin_data_changed", "source": source})

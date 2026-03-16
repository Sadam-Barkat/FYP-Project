"""
WebSocket connection manager for real-time updates.

Broadcast event types (for future use across the app):
- laboratory_updated: new lab result added (admin lab page, etc.)
- patient_discharged: doctor discharged patient (admin dashboard, nurse list)
- vital_updated: nurse added/updated vital (doctor, admin)
- nurse_patient_updated: patient assignment or treatment (nurse list refresh)
- overview_updated: general admin overview refresh
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

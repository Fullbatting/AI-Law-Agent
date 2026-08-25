"""
server.py — Backend entry-point used by the Electron desktop launcher.

Adds /health and /index endpoints on top of the existing /query SSE route,
then starts uvicorn.  All original logic lives in api.py / indexer.py.
"""
import os
import sys
import subprocess
import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Re-use the existing app and route
from api import app, event_stream

# Allow the Electron renderer (file:// or localhost) to call the API
app.add_middleware(
    CORSMiddleware,
    # Allow only localhost origins so the Electron renderer can call the API
    allow_origin_regex=r"https?://(127\.0\.0\.1|localhost)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Lightweight heartbeat used by the Electron launcher."""
    return {"status": "ok"}


@app.post("/index")
async def run_index(request: Request):
    """
    Trigger the indexer from the UI.
    Accepts optional JSON body: {"source": "<path or url>"}
    Streams indexer stdout line-by-line as SSE.
    """
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    source = body.get("source", "sample_legal.json")
    script = os.path.join(os.path.dirname(__file__), "indexer.py")
    python = sys.executable

    async def _stream():
        proc = await asyncio.create_subprocess_exec(
            python, script, "--source", source,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            yield f"data: {json.dumps({'line': line})}\n\n"
        await proc.wait()
        yield f"data: {json.dumps({'done': True, 'returncode': proc.returncode})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("API_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")

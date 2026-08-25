from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json, asyncio

app = FastAPI()

async def event_stream(question):
    for i in range(3):
        yield f"event: progress\ndata: {json.dumps({'stage': 'step', 'i': i})}\n\n"
        await asyncio.sleep(0.2)
    yield f"event: done\ndata: {json.dumps({'stage': 'complete'})}\n\n"

@app.post("/query")
async def query_endpoint(request: Request):
    body = await request.json()
    question = body.get("question", "")
    return StreamingResponse(event_stream(question), media_type="text/event-stream")
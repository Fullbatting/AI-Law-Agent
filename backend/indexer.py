import json, argparse, asyncio
from chunker import chunk_legal_text
from config import settings

async def index_from_file(path: str):
    print("색인 시작:", path)
    with open(path, "r", encoding="utf-8") as f:
        docs = json.load(f)
    chunks = []
    for doc in docs:
        for c in chunk_legal_text(doc["text"]):
            chunks.append({"doc_id": doc.get("id"), "text": c["text"], "meta": c["meta"]})
    print("생성된 청크 수:", len(chunks))
    # DB 삽입 구현 필요

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    args = parser.parse_args()
    asyncio.run(index_from_file(args.source))
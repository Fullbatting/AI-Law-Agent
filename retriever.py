# 하이브리드 검색기 골격 (BM25 + 벡터 검색 결합 필요)
def hybrid_search(query: str, top_k: int = 6):
    return [{"id": "demo", "score": 1.0, "text": "샘플 문서", "meta": {"source_url":"https://example"}}]
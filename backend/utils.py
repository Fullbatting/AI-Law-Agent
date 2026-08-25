def render_citation(meta: dict) -> str:
    doc_type = meta.get("doc_type", "statute")
    article = meta.get("article_tag", "")
    url = meta.get("source_url", "")
    parts = " ".join([p for p in (article, url) if p])
    return f"[출처: {doc_type}:{parts}]"
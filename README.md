# AI-Law-Agent

이 프로젝트는 한국 법률 문서를 RAG 방식으로 응답하는 에이전트의 reference implementation입니다.

빠른 시작:
1. PostgreSQL(및 pgvector) 준비 — db_schema.sql 참고
2. .env 설정 (DATABASE_URL, LLM_BACKEND, LLM_URL 등)
3. pip install -r requirements.txt
4. 색인: python indexer.py --source sample_legal.json
5. 서버 실행: uvicorn api:app --reload --host 0.0.0.0 --port 8000

API:
- POST /query (SSE 스트리밍)
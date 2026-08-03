import os
from pydantic import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/legaldb')
    LLM_BACKEND: str = os.getenv('LLM_BACKEND', 'ollama')
    LLM_URL: str = os.getenv('LLM_URL', 'http://localhost:11434')
    EMBEDDING_MODEL: str = os.getenv('EMBEDDING_MODEL', 'snunlp/KR-SBERT-V40K-kl')
    EMBEDDING_DIM: int = int(os.getenv('EMBEDDING_DIM', '768'))
    TOP_K: int = int(os.getenv('TOP_K', '6'))
    BM25_K: int = int(os.getenv('BM25_K', '10'))
    DISCLAIMER: str = os.getenv('DISCLAIMER', '본 답변은 법률적 참고용입니다.')

settings = Settings()
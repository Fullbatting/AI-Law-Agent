-- PostgreSQL + pgvector 스키마
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS legal_documents (
  id SERIAL PRIMARY KEY,
  doc_type TEXT NOT NULL,
  jurisdiction TEXT,
  title TEXT,
  article_no TEXT,
  clause_no TEXT,
  section_no TEXT,
  full_text TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_embedding ON legal_documents USING ivfflat (embedding) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_legal_documents_fulltext ON legal_documents USING gin (to_tsvector('simple', full_text));
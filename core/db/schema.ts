import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite 스키마 (기술기획서 11장 "채팅 및 캐시 저장" 참고).
 *
 * conversations / messages / api_requests / api_responses / cache
 *
 * Node.js 내장 `node:sqlite` 모듈을 사용한다. `better-sqlite3` 같은
 * 네이티브 애드온 대신 이 모듈을 쓰면 Windows에서 Visual Studio Build
 * Tools 없이도 `npm install`만으로 바로 동작한다 (Node 22.5+ 내장,
 * 실험적 기능 경고만 출력되고 동작에는 영향 없음).
 *
 * `node:sqlite`는 아직 Node의 공식 builtinModules 목록에 등록되지 않은
 * 실험적 모듈이라 esbuild/Vite 같은 번들러가 `import`문을 정적으로 만나면
 * 일반 npm 패키지로 착각해 번들링을 시도하다 실패한다. createRequire로
 * 런타임에만 불러와 번들러의 정적 분석을 피한다.
 */
const nodeRequire = createRequire(process.execPath);
const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");

export type AppDatabase = InstanceType<typeof DatabaseSync>;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '새 대화',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  connector TEXT NOT NULL,
  query_dsl_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES api_requests(id) ON DELETE CASCADE,
  normalized_json TEXT NOT NULL,
  source_label TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cache (
  cache_key TEXT PRIMARY KEY,
  connector TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_message ON api_requests(message_id);
CREATE INDEX IF NOT EXISTS idx_api_responses_request ON api_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
`;

export function openDatabase(dbPath: string): AppDatabase {
  const dir = path.dirname(dbPath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

/** 테스트 등에서 사용할 인메모리 DB */
export function openInMemoryDatabase(): AppDatabase {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

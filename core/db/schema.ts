import fs from "node:fs";
import path from "node:path";
// sql.js는 순수 WebAssembly로 컴파일된 SQLite라 네이티브 애드온이 전혀 없다.
// better-sqlite3(Windows 컴파일 실패)와 Node 내장 node:sqlite(Electron 32의
// 번들 Node 20.x에는 아예 없음 — Electron 메인 프로세스는 시스템에 설치된
// Node가 아니라 Electron 자체에 내장된 Node로 돈다) 둘 다 실제로 검증해보니
// 문제가 있어서, 어떤 런타임(Node/Electron, 어떤 플랫폼)에서도 동일하게
// 동작하는 WASM 구현으로 정착했다.
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";

/**
 * SQLite 스키마 (기술기획서 11장 "채팅 및 캐시 저장" 참고).
 *
 * conversations / messages / api_requests / api_responses / cache
 */
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

// sql.js 초기화(WASM 로딩)는 비용이 있으므로 프로세스당 한 번만 수행하고 재사용한다.
let sqlJsModulePromise: ReturnType<typeof initSqlJs> | undefined;
function getSqlJs() {
  if (!sqlJsModulePromise) {
    sqlJsModulePromise = initSqlJs();
  }
  return sqlJsModulePromise;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * better-sqlite3/node:sqlite와 동일한 모양(prepare().run()/.get()/.all())의
 * 호출부를 유지하기 위한 sql.js 위의 얇은 어댑터.
 *
 * CacheManager/ConversationManager 등 상위 코드는 이 클래스의 존재를
 * 몰라도 되고, DB 구현이 또 바뀌어도 core/db/schema.ts만 손대면 된다.
 */
export class AppDatabase {
  constructor(
    private readonly db: SqlJsDatabase,
    /** 파일 기반 DB에서 쓰기 후 디스크에 저장하는 콜백. 인메모리 DB는 no-op. */
    private readonly persist: () => void
  ) {}

  exec(sql: string): void {
    this.db.run(sql);
    this.persist();
  }

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db, sql, this.persist);
  }
}

class PreparedStatement {
  constructor(
    private readonly db: SqlJsDatabase,
    private readonly sql: string,
    private readonly persist: () => void
  ) {}

  run(...args: unknown[]): RunResult {
    const params = normalizeParams(args);
    if (params) {
      this.db.run(this.sql, params as never);
    } else {
      this.db.run(this.sql);
    }
    const changes = this.db.getRowsModified();
    const lastInsertRowid = this.queryLastInsertRowid();
    this.persist();
    return { changes, lastInsertRowid };
  }

  get(...args: unknown[]): Record<string, unknown> | undefined {
    const stmt = this.db.prepare(this.sql);
    try {
      this.bind(stmt, args);
      const hasRow = stmt.step();
      return hasRow ? (stmt.getAsObject() as Record<string, unknown>) : undefined;
    } finally {
      stmt.free();
    }
  }

  all(...args: unknown[]): Record<string, unknown>[] {
    const stmt = this.db.prepare(this.sql);
    try {
      this.bind(stmt, args);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  private bind(stmt: ReturnType<SqlJsDatabase["prepare"]>, args: unknown[]): void {
    const params = normalizeParams(args);
    if (params) stmt.bind(params as never);
  }

  private queryLastInsertRowid(): number {
    const result = this.db.exec("SELECT last_insert_rowid() AS id");
    const value = result[0]?.values?.[0]?.[0];
    return typeof value === "number" ? value : Number(value ?? 0);
  }
}

/**
 * better-sqlite3/node:sqlite는 `.run({key: 1})`처럼 접두사 없는 객체 키를
 * `@key`/`:key`/`$key` 플레이스홀더에 알아서 매칭해주지만, sql.js는 그렇게
 * 하지 않고 조용히 NULL을 바인딩한다(에러도 안 남). 그래서 객체 파라미터의
 * 키에는 항상 `@`를 붙여 넘긴다. 위치 기반(`?`) 파라미터는 배열 그대로 둔다.
 */
function normalizeParams(args: unknown[]): unknown[] | Record<string, unknown> | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 1 && isPlainObject(args[0])) {
    const prefixed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args[0] as Record<string, unknown>)) {
      prefixed[key.startsWith("@") || key.startsWith(":") || key.startsWith("$") ? key : `@${key}`] = value;
    }
    return prefixed;
  }
  return args;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function openDatabase(dbPath: string): Promise<AppDatabase> {
  const SQL = await getSqlJs();

  const dir = path.dirname(dbPath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  const sqlJsDb = existing ? new SQL.Database(existing) : new SQL.Database();

  const persist = () => {
    fs.writeFileSync(dbPath, Buffer.from(sqlJsDb.export()));
  };

  sqlJsDb.run("PRAGMA foreign_keys = ON");
  sqlJsDb.run(SCHEMA_SQL);
  persist();

  return new AppDatabase(sqlJsDb, persist);
}

/** 테스트 등에서 사용할 인메모리 DB (디스크에 저장하지 않는다) */
export async function openInMemoryDatabase(): Promise<AppDatabase> {
  const SQL = await getSqlJs();
  const sqlJsDb = new SQL.Database();
  sqlJsDb.run("PRAGMA foreign_keys = ON");
  sqlJsDb.run(SCHEMA_SQL);
  return new AppDatabase(sqlJsDb, () => {});
}

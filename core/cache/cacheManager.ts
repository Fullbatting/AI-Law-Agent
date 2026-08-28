import crypto from "node:crypto";
import type { AppDatabase } from "../db/schema";
import type { NormalizedResult } from "../types/domain";
import type { QueryDSL } from "../query/dsl/types";

/**
 * Connector별 TTL(초). 데이터 최신성이 중요한 법령은 짧게, 병원 기본정보는
 * 하루 정도로 설정한다 (기술기획서 12장 참고).
 */
export const DEFAULT_TTL_SECONDS: Record<string, number> = {
  law: 60 * 60, // 1시간
  hira: 60 * 60 * 24, // 1일
};

const FALLBACK_TTL_SECONDS = 60 * 60 * 6; // 미지정 Connector 기본 6시간

export class CacheManager {
  constructor(
    private readonly db: AppDatabase,
    private readonly ttlBySource: Record<string, number> = DEFAULT_TTL_SECONDS
  ) {}

  get(dsl: QueryDSL): NormalizedResult | undefined {
    const key = this.hashQuery(dsl);
    const row = this.db
      .prepare("SELECT value_json, expires_at FROM cache WHERE cache_key = ?")
      .get(key) as { value_json: string; expires_at: string } | undefined;
    if (!row) return undefined;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.db.prepare("DELETE FROM cache WHERE cache_key = ?").run(key);
      return undefined;
    }
    return JSON.parse(row.value_json) as NormalizedResult;
  }

  set(dsl: QueryDSL, result: NormalizedResult): void {
    const key = this.hashQuery(dsl);
    const ttlSeconds = this.ttlBySource[dsl.source] ?? FALLBACK_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    this.db
      .prepare(
        `INSERT INTO cache (cache_key, connector, value_json, expires_at)
         VALUES (@key, @connector, @value, @expiresAt)
         ON CONFLICT(cache_key) DO UPDATE SET
           value_json = excluded.value_json,
           expires_at = excluded.expires_at,
           created_at = datetime('now')`
      )
      .run({
        key,
        connector: dsl.source,
        value: JSON.stringify(result),
        expiresAt,
      });
  }

  clearAll(): void {
    this.db.prepare("DELETE FROM cache").run();
  }

  clearExpired(): void {
    this.db.prepare("DELETE FROM cache WHERE expires_at < datetime('now')").run();
  }

  private hashQuery(dsl: QueryDSL): string {
    const normalized = stableStringify(dsl);
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
}

/** 키 순서와 무관하게 동일한 문자열을 만들기 위한 재귀적 안정 직렬화 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

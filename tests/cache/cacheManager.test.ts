import { describe, expect, it } from "vitest";
import { openInMemoryDatabase } from "../../core/db/schema";
import { CacheManager } from "../../core/cache/cacheManager";
import type { NormalizedResult } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";

function makeResult(): NormalizedResult {
  return {
    entity: "hospital",
    source: "hira",
    sourceLabel: "건강보험심사평가원(HIRA)",
    fetchedAt: new Date().toISOString(),
    rows: [{ name: "가나병원" }],
  };
}

const dsl: QueryDSL = {
  source: "hira",
  operation: "search",
  entity: "hospital",
  filters: [{ field: "region", operator: "eq", value: "서울" }],
};

describe("CacheManager", () => {
  it("캐시가 없으면 undefined를 반환한다", async () => {
    const cache = new CacheManager(await openInMemoryDatabase());
    expect(cache.get(dsl)).toBeUndefined();
  });

  it("저장한 결과를 동일한 DSL로 다시 조회할 수 있다", async () => {
    const cache = new CacheManager(await openInMemoryDatabase());
    const result = makeResult();
    cache.set(dsl, result);
    expect(cache.get(dsl)).toEqual(result);
  });

  it("필터 순서가 달라도 같은 캐시 키로 취급한다", async () => {
    const cache = new CacheManager(await openInMemoryDatabase());
    const result = makeResult();
    cache.set(dsl, result);

    const reordered: QueryDSL = {
      operation: "search",
      entity: "hospital",
      source: "hira",
      filters: [{ value: "서울", field: "region", operator: "eq" }],
    };
    expect(cache.get(reordered)).toEqual(result);
  });

  it("만료된 캐시는 조회 시 삭제되고 undefined를 반환한다", async () => {
    const cache = new CacheManager(await openInMemoryDatabase(), { hira: -1 });
    cache.set(dsl, makeResult());
    expect(cache.get(dsl)).toBeUndefined();
  });

  it("clearAll 이후에는 모든 캐시가 사라진다", async () => {
    const cache = new CacheManager(await openInMemoryDatabase());
    cache.set(dsl, makeResult());
    cache.clearAll();
    expect(cache.get(dsl)).toBeUndefined();
  });
});

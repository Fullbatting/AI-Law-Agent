import { describe, expect, it, vi, afterEach } from "vitest";
import { CustomApiConnector } from "../../connectors/generic/customApiConnector";
import type { CustomApiConfig } from "../../core/settings/settingsManager";
import type { QueryDSL } from "../../core/query/dsl/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseConfig: CustomApiConfig = {
  id: "abc123",
  name: "테스트 API",
  baseUrl: "https://example.com/api",
  authType: "query",
  authKeyName: "serviceKey",
  authValue: "MY_KEY",
  searchParamName: "query",
};

const dsl: QueryDSL = {
  source: "custom:abc123",
  operation: "search",
  entity: "item",
  filters: [{ field: "query", operator: "eq", value: "서울 날씨" }],
  limit: 10,
};

describe("CustomApiConnector", () => {
  it("쿼리 파라미터 인증 방식이면 URL에 인증키를 붙인다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [{ a: 1 }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = new CustomApiConnector(baseConfig);
    await connector.request(connector.buildParams(dsl));

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("serviceKey")).toBe("MY_KEY");
    expect(calledUrl.searchParams.get("query")).toBe("서울 날씨");
  });

  it("헤더 인증 방식이면 fetch에 헤더로 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: CustomApiConfig = { ...baseConfig, authType: "header", authKeyName: "X-API-Key" };
    const connector = new CustomApiConnector(config);
    await connector.request(connector.buildParams(dsl));

    const options = fetchMock.mock.calls[0][1] as { headers?: Record<string, string> };
    expect(options.headers?.["X-API-Key"]).toBe("MY_KEY");
  });

  it("Bearer 토큰 방식이면 Authorization 헤더를 붙인다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: CustomApiConfig = { ...baseConfig, authType: "bearer", authKeyName: undefined };
    const connector = new CustomApiConnector(config);
    await connector.request(connector.buildParams(dsl));

    const options = fetchMock.mock.calls[0][1] as { headers?: Record<string, string> };
    expect(options.headers?.["Authorization"]).toBe("Bearer MY_KEY");
  });

  it("고정 파라미터(extraQueryParams)를 항상 붙인다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: CustomApiConfig = { ...baseConfig, extraQueryParams: "dataType=JSON&numOfRows=5" };
    const connector = new CustomApiConnector(config);
    await connector.request(connector.buildParams(dsl));

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("dataType")).toBe("JSON");
    expect(calledUrl.searchParams.get("numOfRows")).toBe("5");
  });

  it("응답에서 객체 배열을 찾아 표로 정규화한다", () => {
    const connector = new CustomApiConnector(baseConfig);
    const raw = { response: { body: { items: [{ name: "서울", temp: 20 }, { name: "부산", temp: 22 }] } } };

    const normalized = connector.normalize(raw);

    expect(normalized.rows).toEqual([
      { name: "서울", temp: 20 },
      { name: "부산", temp: 22 },
    ]);
    expect(normalized.sourceLabel).toBe("테스트 API");
    expect(normalized.source).toBe("custom:abc123");
  });

  it("배열을 못 찾으면 응답 객체 자체를 한 행으로 감싼다", () => {
    const connector = new CustomApiConnector(baseConfig);
    const raw = { name: "단일 응답", value: 42 };

    const normalized = connector.normalize(raw);

    expect(normalized.rows).toEqual([{ name: "단일 응답", value: 42 }]);
  });

  it("중첩 객체/배열 값은 JSON 문자열로 펴서 담는다", () => {
    const connector = new CustomApiConnector(baseConfig);
    const raw = { items: [{ name: "A", nested: { x: 1 } }] };

    const normalized = connector.normalize(raw);

    expect(normalized.rows[0].name).toBe("A");
    expect(normalized.rows[0].nested).toBe(JSON.stringify({ x: 1 }));
  });

  it("검색어 파라미터 이름이 설정되지 않았으면 검색어를 붙이지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: CustomApiConfig = { ...baseConfig, searchParamName: undefined };
    const connector = new CustomApiConnector(config);
    await connector.request(connector.buildParams(dsl));

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("query")).toBeNull();
  });

  it("JSON이 아닌 응답은 원본 텍스트를 감싸서 반환하고 정규화해도 에러가 나지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<xml>not json</xml>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = new CustomApiConnector(baseConfig);
    const raw = await connector.request(connector.buildParams(dsl));
    const normalized = connector.normalize(raw);

    expect(normalized.rows).toEqual([{ __rawText: "<xml>not json</xml>" }]);
  });
});

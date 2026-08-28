import { describe, expect, it, vi, afterEach } from "vitest";
import { LawSearchConnector } from "../../connectors/law/search";
import type { QueryDSL } from "../../core/query/dsl/types";

const SAMPLE_RESPONSE = {
  LawSearch: {
    totalCnt: "1",
    law: [
      {
        법령일련번호: "12345",
        법령명한글: "개인정보 보호법",
        법령구분명: "법률",
        소관부처명: "개인정보보호위원회",
        공포일자: "20230101",
        시행일자: "20230701",
        법령상세링크: "/DRF/lawService.do?OC=test&target=law&ID=12345",
      },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LawSearchConnector", () => {
  const dsl: QueryDSL = {
    source: "law",
    operation: "search",
    entity: "law",
    filters: [{ field: "query", operator: "eq", value: "개인정보 수집" }],
    limit: 20,
  };

  it("OC가 없으면 request가 에러를 던진다", async () => {
    const connector = new LawSearchConnector(undefined, "");
    await expect(connector.request({ filters: {} })).rejects.toThrow(/LAW_API_OC/);
  });

  it("정상 응답을 표준 법령 레코드로 정규화한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(SAMPLE_RESPONSE),
      })
    );
    const connector = new LawSearchConnector(undefined, "test@example.com");
    const raw = await connector.request(connector.buildParams(dsl));
    const normalized = connector.normalize(raw);

    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0]).toMatchObject({
      name: "개인정보 보호법",
      ministry: "개인정보보호위원회",
      effective_date: "20230701",
    });
    expect(normalized.sourceLabel).toBe("법제처 국가법령정보센터");
  });
});

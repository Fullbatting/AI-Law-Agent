import { describe, expect, it } from "vitest";
import { parseAndValidateQueryPlan, validateQueryPlan } from "../../core/query/validator/dslValidator";

describe("dslValidator", () => {
  it("유효한 QueryPlan JSON을 통과시킨다", () => {
    const raw = {
      intent: "hospital_search",
      queries: [
        {
          source: "hira",
          operation: "search",
          entity: "hospital",
          filters: [{ field: "region", operator: "eq", value: "서울" }],
          limit: 20,
        },
      ],
    };
    const result = validateQueryPlan(raw);
    expect(result.ok).toBe(true);
  });

  it("알 수 없는 operation은 거부한다", () => {
    const raw = {
      intent: "x",
      queries: [{ source: "hira", operation: "delete", entity: "hospital" }],
    };
    const result = validateQueryPlan(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("queries가 빈 배열이면 거부한다", () => {
    const result = validateQueryPlan({ intent: "x", queries: [] });
    expect(result.ok).toBe(false);
  });

  it("코드펜스로 감싼 JSON 문자열도 파싱한다", () => {
    const text = [
      "```json",
      JSON.stringify({
        intent: "hospital_search",
        queries: [{ source: "hira", operation: "search", entity: "hospital" }],
      }),
      "```",
    ].join("\n");
    const result = parseAndValidateQueryPlan(text);
    expect(result.ok).toBe(true);
  });

  it("잘못된 JSON 문자열은 사람이 읽을 수 있는 오류를 반환한다", () => {
    const result = parseAndValidateQueryPlan("이건 JSON이 아닙니다");
    expect(result.ok).toBe(false);
  });

  it("limit이 최대치를 넘으면 거부한다", () => {
    const raw = {
      intent: "x",
      queries: [{ source: "hira", operation: "search", entity: "hospital", limit: 5000 }],
    };
    const result = validateQueryPlan(raw);
    expect(result.ok).toBe(false);
  });
});

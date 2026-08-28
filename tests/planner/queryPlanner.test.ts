import { describe, expect, it } from "vitest";
import { QueryPlanner } from "../../core/planner/queryPlanner";
import { RuleBasedFallbackRuntime } from "../../core/llm/inference/ruleBasedFallback";
import { ToolRegistry } from "../../core/tools/registry";

describe("QueryPlanner (규칙 기반 폴백 SLM 사용)", () => {
  const planner = new QueryPlanner(new RuleBasedFallbackRuntime(), new ToolRegistry());

  it("병원 검색 질문을 QueryDSL로 변환한다", async () => {
    const result = await planner.plan("서울에 있는 종합병원 20개를 병원명과 주소만 보여줘.");
    expect(result.ok).toBe(true);
    const dsl = result.plan?.queries[0];
    expect(dsl?.source).toBe("hira");
    expect(dsl?.filters).toContainEqual({ field: "region", operator: "eq", value: "서울" });
    expect(dsl?.filters).toContainEqual({
      field: "hospital_type",
      operator: "eq",
      value: "종합병원",
    });
    expect(dsl?.select).toEqual(["name", "address"]);
    expect(dsl?.limit).toBe(20);
  });

  it("지역별 집계 질문을 group_by/aggregate로 변환한다", async () => {
    const result = await planner.plan("지역별 병원 수를 집계해줘.");
    const dsl = result.plan?.queries[0];
    expect(dsl?.group_by).toEqual(["region"]);
    expect(dsl?.aggregate).toEqual([{ fn: "count", as: "count" }]);
  });

  it("법령 관련 질문을 law_search로 변환한다", async () => {
    const result = await planner.plan("개인정보를 몰래 수집하면 어떤 법을 위반할 수 있어?");
    const dsl = result.plan?.queries[0];
    expect(dsl?.source).toBe("law");
    expect(dsl?.entity).toBe("law");
  });
});

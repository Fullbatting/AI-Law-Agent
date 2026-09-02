import { describe, expect, it } from "vitest";
import { RuleBasedFallbackRuntime } from "../../core/llm/inference/ruleBasedFallback";
import type { NormalizedResult } from "../../core/types/domain";
import type { CustomApiConfig } from "../../core/settings/settingsManager";
import type { QueryPlan } from "../../core/query/dsl/types";

describe("RuleBasedFallbackRuntime.summarize", () => {
  it("실제 언어 이해 없이 출처/건수만 담은 고정 템플릿을 돌려준다", async () => {
    const runtime = new RuleBasedFallbackRuntime();
    const results: NormalizedResult[] = [
      {
        entity: "hospital",
        source: "hira",
        sourceLabel: "건강보험심사평가원(HIRA)",
        fetchedAt: "2026-08-28T00:00:00.000Z",
        rows: [{ name: "가나병원" }, { name: "다라병원" }],
      },
    ];

    const summary = await runtime.summarize({ userQuestion: "아무 질문", results });

    expect(summary).toBe(
      "건강보험심사평가원(HIRA)에서 2건을 찾았습니다. (조회시간: 2026-08-28T00:00:00.000Z)"
    );
  });

  it("여러 결과가 있으면 결과마다 한 줄씩 요약한다", async () => {
    const runtime = new RuleBasedFallbackRuntime();
    const results: NormalizedResult[] = [
      {
        entity: "hospital",
        source: "hira",
        sourceLabel: "건강보험심사평가원(HIRA)",
        fetchedAt: "2026-08-28T00:00:00.000Z",
        rows: [{ name: "가나병원" }],
      },
      {
        entity: "law",
        source: "law",
        sourceLabel: "법제처 국가법령정보센터",
        fetchedAt: "2026-08-28T00:00:00.000Z",
        rows: [],
      },
    ];

    const summary = await runtime.summarize({ userQuestion: "아무 질문", results });
    expect(summary.split("\n")).toHaveLength(2);
  });
});

const WEATHER_API: CustomApiConfig = {
  id: "weather1",
  name: "기상청 단기예보",
  baseUrl: "https://apis.data.go.kr/weather",
  authType: "query",
  description: "지역별 날씨 기온 강수확률 예보 조회",
};

describe("RuleBasedFallbackRuntime.complete — 커스텀 API 자동 라우팅", () => {
  it("등록된 커스텀 API가 없으면 기존과 동일하게 병원 검색으로 처리한다", async () => {
    const runtime = new RuleBasedFallbackRuntime();
    const plan: QueryPlan = JSON.parse(await runtime.complete({ system: "", prompt: "", userText: "서울 병원 찾아줘" }));
    expect(plan.queries[0].source).toBe("hira");
  });

  it("질문에 등록된 커스텀 API 이름이 그대로 들어있으면 그 API로 확정한다", async () => {
    const runtime = new RuleBasedFallbackRuntime(() => [WEATHER_API]);
    const plan: QueryPlan = JSON.parse(
      await runtime.complete({ system: "", prompt: "", userText: "기상청 단기예보로 서울 날씨 알려줘" })
    );
    expect(plan.queries[0].source).toBe("custom:weather1");
    expect(plan.queries[0].filters?.[0]).toMatchObject({ field: "query" });
  });

  it("이름이 언급되지 않아도 설명과 겹치는 단어가 충분하면 자동으로 그 API를 고른다", async () => {
    const runtime = new RuleBasedFallbackRuntime(() => [WEATHER_API]);
    const plan: QueryPlan = JSON.parse(
      await runtime.complete({ system: "", prompt: "", userText: "서울 지역 날씨 기온 알려줘" })
    );
    expect(plan.queries[0].source).toBe("custom:weather1");
  });

  it("겹치는 단어가 거의 없는 무관한 질문은 커스텀 API로 잘못 보내지 않는다", async () => {
    const runtime = new RuleBasedFallbackRuntime(() => [WEATHER_API]);
    const plan: QueryPlan = JSON.parse(
      await runtime.complete({ system: "", prompt: "", userText: "서울 종합병원 목록을 보여줘" })
    );
    expect(plan.queries[0].source).toBe("hira");
  });

  it("법령 키워드가 있으면 커스텀 API 이름 언급이 없는 한 법제처를 우선한다", async () => {
    const runtime = new RuleBasedFallbackRuntime(() => [WEATHER_API]);
    const plan: QueryPlan = JSON.parse(
      await runtime.complete({ system: "", prompt: "", userText: "개인정보 관련 법령 찾아줘" })
    );
    expect(plan.queries[0].source).toBe("law");
  });

  it("이름/설명만으로는 겹치지 않아도 등록해둔 예시 질문과 겹치면 그 API로 라우팅한다", async () => {
    const exchangeApi: CustomApiConfig = {
      id: "exchange1",
      name: "환율정보API",
      baseUrl: "https://apis.data.go.kr/exchange",
      authType: "query",
      description: "금융 데이터 제공", // 질문과 겹치는 단어가 없다
      exampleQuestions: ["오늘 원달러 환율 알려줘"],
    };
    const runtime = new RuleBasedFallbackRuntime(() => [exchangeApi]);
    const plan: QueryPlan = JSON.parse(
      await runtime.complete({ system: "", prompt: "", userText: "오늘 원달러 환율 알려줘" })
    );
    expect(plan.queries[0].source).toBe("custom:exchange1");
  });

  it("(대조군) 같은 API에 예시 질문이 없으면 이름/설명만으로는 라우팅되지 않는다", async () => {
    const exchangeApiNoExamples: CustomApiConfig = {
      id: "exchange1",
      name: "환율정보API",
      baseUrl: "https://apis.data.go.kr/exchange",
      authType: "query",
      description: "금융 데이터 제공",
    };
    const runtime = new RuleBasedFallbackRuntime(() => [exchangeApiNoExamples]);
    const plan: QueryPlan = JSON.parse(
      await runtime.complete({ system: "", prompt: "", userText: "오늘 원달러 환율 알려줘" })
    );
    expect(plan.queries[0].source).toBe("hira");
  });
});

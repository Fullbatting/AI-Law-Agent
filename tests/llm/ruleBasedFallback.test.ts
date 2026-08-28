import { describe, expect, it } from "vitest";
import { RuleBasedFallbackRuntime } from "../../core/llm/inference/ruleBasedFallback";
import type { NormalizedResult } from "../../core/types/domain";

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

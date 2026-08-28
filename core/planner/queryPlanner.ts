import type { SlmRuntime } from "../llm/inference/types";
import type { ToolRegistry } from "../tools/registry";
import type { QueryPlan } from "../query/dsl/types";
import { buildSystemPrompt } from "../llm/prompt/systemPrompt";
import { buildUserPrompt } from "../llm/prompt/buildPrompt";
import { parseAndValidateQueryPlan } from "../query/validator/dslValidator";

export interface PlanningResult {
  ok: boolean;
  plan?: QueryPlan;
  error?: string;
  /** 디버깅/대화 이력 저장용: SLM 원본 출력 */
  rawSlmOutput?: string;
}

/**
 * 사용자의 자연어 질문 → QueryPlan(QueryDSL 목록) 변환을 담당한다.
 * SLM 출력이 스키마를 만족하지 못하면 오류 메시지를 붙여 1회 재생성을 시도한다
 * (기술기획서 25장 "SLM이 잘못된 Query 생성" 리스크 대응).
 */
export class QueryPlanner {
  constructor(
    /**
     * 고정된 인스턴스 대신 조회 함수로 받는다 — 사용자가 앱을 쓰는 도중
     * GGUF 모델을 로드/해제하면 다음 질의부터 바로 그 런타임을 쓰도록
     * ModelManager가 매 호출 시점의 최신 런타임을 돌려준다.
     */
    private readonly slmProvider: () => SlmRuntime,
    private readonly registry: ToolRegistry,
    private readonly maxRetries: number = 1
  ) {}

  async plan(userText: string): Promise<PlanningResult> {
    const system = buildSystemPrompt(this.registry);
    const prompt = buildUserPrompt(userText);
    const slm = this.slmProvider();

    let lastRawOutput = "";
    let correctionHint: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const rawOutput = await slm.complete({ system, prompt, userText, correctionHint });
      lastRawOutput = rawOutput;

      const validation = parseAndValidateQueryPlan(rawOutput);
      if (validation.ok) {
        return { ok: true, plan: validation.data, rawSlmOutput: rawOutput };
      }

      correctionHint = validation.errors.join("\n");
      if (attempt === this.maxRetries) {
        return {
          ok: false,
          error: `SLM이 유효한 QueryDSL을 생성하지 못했습니다: ${correctionHint}`,
          rawSlmOutput: lastRawOutput,
        };
      }
    }

    // 도달하지 않지만 타입 안전을 위해 명시
    return { ok: false, error: "알 수 없는 오류", rawSlmOutput: lastRawOutput };
  }
}

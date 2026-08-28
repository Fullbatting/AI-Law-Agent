import type { NormalizedResult } from "../../types/domain";

/**
 * SLM 런타임 공통 인터페이스.
 * llama.cpp 서버, 규칙 기반 폴백 등 어떤 구현체든 이 인터페이스만 만족하면
 * Query Planner가 그대로 사용할 수 있다 (기술기획서 17장 "초기 단계" 참고:
 * 파인튜닝 전에 프롬프트+스키마 검증 조합으로 먼저 검증한다).
 *
 * 두 가지 완전히 다른 용도로 SLM을 쓴다 (기술기획서 3장/26장 다이어그램의
 * "자연어 → SLM → Query DSL"과 "결과 → SLM → 사용자 설명"에 각각 대응):
 * - complete(): 자연어 질문을 구조화된 Query DSL JSON으로 변환한다.
 * - summarize(): 이미 조회된 데이터를 사람이 읽기 쉬운 설명으로 풀어준다.
 *   이때도 SLM이 데이터를 새로 만들어내는 게 아니라, 이미 검증된 데이터를
 *   "매끄럽게" 설명하는 역할만 한다 — 실제 표/원본 데이터는 항상 별도로
 *   그대로 노출된다.
 */
export interface SlmCompletionRequest {
  system: string;
  /** Few-shot 예시 등이 포함된, 실제 모델에 넘길 완성된 프롬프트 */
  prompt: string;
  /**
   * few-shot 예시가 섞이지 않은 사용자의 원본 질문.
   * 규칙 기반 폴백처럼 프롬프트 엔지니어링 없이 질문 자체만 필요한 구현체를 위해 별도로 전달한다.
   */
  userText: string;
  maxTokens?: number;
  /** JSON 출력이 깨졌을 때 재요청하기 위한 이전 오류 메시지 (few-shot 보정용) */
  correctionHint?: string;
}

export interface SlmSummarizeRequest {
  /** 사용자가 원래 물어본 질문 (설명의 맥락을 맞추는 데 사용) */
  userQuestion: string;
  /** Tool Router가 실제로 조회해온 결과. SLM은 이 안의 값만 근거로 설명해야 한다 */
  results: NormalizedResult[];
  maxTokens?: number;
}

export interface SlmRuntime {
  readonly name: string;
  complete(request: SlmCompletionRequest): Promise<string>;
  summarize(request: SlmSummarizeRequest): Promise<string>;
}

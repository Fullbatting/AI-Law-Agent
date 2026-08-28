/**
 * SLM 런타임 공통 인터페이스.
 * llama.cpp 서버, 규칙 기반 폴백 등 어떤 구현체든 이 인터페이스만 만족하면
 * Query Planner가 그대로 사용할 수 있다 (기술기획서 17장 "초기 단계" 참고:
 * 파인튜닝 전에 프롬프트+스키마 검증 조합으로 먼저 검증한다).
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

export interface SlmRuntime {
  readonly name: string;
  complete(request: SlmCompletionRequest): Promise<string>;
}

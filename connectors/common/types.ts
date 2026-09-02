import type { z } from "zod";
import type { NormalizedResult, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";

/**
 * 모든 API Connector가 구현해야 하는 공통 인터페이스.
 * (기술기획서 4장 "공통 Connector 인터페이스" 참고)
 */
export interface ApiConnector {
  /** Tool Registry에서 참조하는 고유 이름. 예: "hira_hospital_search" */
  readonly name: string;
  readonly description: string;
  /** 이 Connector가 속한 기관/출처. 예: "hira", "law" */
  readonly source: string;
  /** 이 Connector가 다루는 엔티티. 예: "hospital" */
  readonly entity: string;
  /** 사람이 읽을 수 있는 출처 표기 (UI에 "데이터 출처: ..."로 표시) */
  readonly sourceLabel: string;
  /** 원본 API 응답 검증용 Zod 스키마 (선택) */
  readonly responseSchema?: z.ZodTypeAny;
  /**
   * 이 Connector가 답할 수 있는 질문 예시. SLM 시스템 프롬프트(모델이 있을 때)와
   * 규칙 기반 폴백의 키워드 매칭(모델이 없을 때) 양쪽에서 "이 질문을 어느
   * API로 보낼지" 인식 정확도를 높이는 힌트로 쓰인다 (core/tools/registry.ts
   * describeForPrompt, core/llm/inference/ruleBasedFallback.ts 참고).
   */
  readonly exampleQuestions?: string[];

  /** QueryDSL을 이 Connector가 이해하는 요청 파라미터로 변환한다 */
  buildParams(dsl: QueryDSL): ConnectorRequestParams;

  /** 실제 API를 호출한다 */
  request(params: ConnectorRequestParams): Promise<unknown>;

  /** 원본 응답(JSON/XML 파싱 결과)을 내부 표준 레코드 배열로 변환한다 */
  normalize(rawResponse: unknown): NormalizedResult;
}

export interface ApiClientOptions {
  timeoutMs?: number;
  retries?: number;
  /** 커스텀 API의 헤더 기반 인증(header/bearer) 및 그 외 고정 헤더에 쓰인다 */
  headers?: Record<string, string>;
  /** 기본값 GET. 커스텀 API가 POST로만 검색을 지원하는 경우 등에 쓴다 */
  method?: "GET" | "POST";
  /** method가 POST일 때 보낼 요청 본문(문자열, 보통 JSON) */
  body?: string;
}

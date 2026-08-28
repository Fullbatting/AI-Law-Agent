/**
 * Connector 전반에서 공유하는 공통 타입.
 */

/** Connector가 원본 API 응답을 정규화한 뒤 돌려주는 표준 레코드 (컬럼명 → 값) */
export type NormalizedRecord = Record<string, string | number | boolean | null>;

export interface NormalizedResult {
  entity: string;
  source: string;
  /** 원본 API 호출 시각 */
  fetchedAt: string;
  /** 사람이 읽을 수 있는 출처 표기 (예: "건강보험심사평가원") */
  sourceLabel: string;
  rows: NormalizedRecord[];
  totalCount?: number;
}

export interface ConnectorRequestParams {
  filters?: Record<string, string | number | boolean | undefined>;
  page?: number;
  numOfRows?: number;
}

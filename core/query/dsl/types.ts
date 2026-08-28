/**
 * 내부 표준 Query DSL 타입 정의.
 *
 * SLM은 사용자의 자연어 질문을 이 구조로 변환하고, Connector는 각 API의
 * 실제 문법으로 다시 변환한다. API가 늘어나도 이 DSL은 그대로 유지한다.
 *
 * (기술기획서 10장 참고)
 */

export type FilterOperator =
  | "eq"
  | "ne"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in";

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | Array<string | number>;
}

export interface QuerySort {
  field: string;
  order: "asc" | "desc";
}

export interface QueryAggregate {
  /** count, sum, avg, min, max */
  fn: "count" | "sum" | "avg" | "min" | "max";
  field?: string;
  /** 결과에 표시할 별칭 */
  as?: string;
}

export type QueryOperation =
  | "search"
  | "get"
  | "filter"
  | "sort"
  | "group"
  | "aggregate"
  | "join"
  | "compare"
  | "export";

export interface QueryJoin {
  /** join 대상이 되는 두 번째 QueryDSL */
  with: QueryDSL;
  /** 두 결과를 연결할 필드 (동일 필드명 기준) */
  on: string;
}

export interface QueryDSL {
  /** Connector 이름. 예: "hira", "law" */
  source: string;
  operation: QueryOperation;
  /** 조회 대상 엔티티. 예: "hospital", "law" */
  entity: string;
  filters?: QueryFilter[];
  select?: string[];
  sort?: QuerySort | null;
  group_by?: string[];
  aggregate?: QueryAggregate[];
  join?: QueryJoin;
  limit?: number;
  /** operation === "export" 일 때 출력 형식 */
  export_format?: "excel" | "csv" | "json";
}

/** SLM이 생성해야 하는 최상위 응답 형태: 하나 이상의 QueryDSL과 사용자에게 보여줄 설명 힌트 */
export interface QueryPlan {
  intent: string;
  queries: QueryDSL[];
}

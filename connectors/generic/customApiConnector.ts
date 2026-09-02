import type { ApiConnector } from "../common/types";
import type { NormalizedResult, NormalizedRecord, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";
import type { CustomApiConfig } from "../../core/settings/settingsManager";
import { ApiClient } from "../common/apiClient";
import { normalizeServiceKey } from "../common/serviceKey";

/**
 * 사용자가 설정 화면에서 등록한 임의의(범용) API를 위한 Connector.
 *
 * HIRA/법제처 Connector처럼 필드별 매핑 코드(지역코드 사전, Zod 스키마 등)를
 * 새로 짜지 않고도 어떤 REST API든 최소한의 형태로 호출할 수 있게 하는 것이
 * 목적이다. 그 대가로 지원 범위는 "검색어 하나 + 고정 파라미터"로 제한되고,
 * 응답 정규화도 "그 안에서 그럴듯한 배열을 찾아 평평하게 펴는" 휴리스틱이라
 * HIRA/법제처 Connector만큼 깔끔한 컬럼명이 나오진 않는다.
 */
/** buildParams가 검색어를 담아두는 내부 전용 키. URL 쿼리에는 절대 실리지 않고, request()가 POST 본문 템플릿 치환에만 쓴다. */
const INTERNAL_SEARCH_TERM_KEY = "__searchTerm";

export class CustomApiConnector implements ApiConnector {
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly entity = "item";
  readonly sourceLabel: string;
  readonly exampleQuestions: string[];

  constructor(
    private readonly config: CustomApiConfig,
    private readonly apiClient: ApiClient = new ApiClient()
  ) {
    this.name = `custom_${config.id}`;
    this.description = config.description?.trim() || `${config.name} API 조회`;
    this.source = `custom:${config.id}`;
    this.sourceLabel = config.name;
    this.exampleQuestions = config.exampleQuestions ?? [];
  }

  buildParams(dsl: QueryDSL): ConnectorRequestParams {
    const filters: ConnectorRequestParams["filters"] = {};
    const queryFilter = dsl.filters?.find(
      (f) => (f.field === "query" || f.field === "keyword") && f.value !== undefined && f.value !== ""
    );
    if (queryFilter) {
      const term = String(queryFilter.value);
      if (this.config.searchParamName) filters[this.config.searchParamName] = term;
      // 검색 파라미터 이름을 지정하지 않았어도(예: POST 본문에서만 쓰는 경우)
      // request()가 본문 템플릿을 치환할 수 있도록 항상 보관해둔다.
      filters[INTERNAL_SEARCH_TERM_KEY] = term;
    }
    return { filters, numOfRows: dsl.limit ?? 50, page: 1 };
  }

  async request(params: ConnectorRequestParams): Promise<unknown> {
    const url = new URL(this.config.baseUrl);

    if (this.config.extraQueryParams) {
      for (const [key, value] of new URLSearchParams(this.config.extraQueryParams).entries()) {
        url.searchParams.set(key, value);
      }
    }
    for (const [key, value] of Object.entries(params.filters ?? {})) {
      if (key === INTERNAL_SEARCH_TERM_KEY) continue;
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = parseHeaderLines(this.config.extraHeaders);
    const authValue = this.config.authValue?.trim() ?? "";
    if (this.config.authType === "query" && this.config.authKeyName && authValue) {
      url.searchParams.set(this.config.authKeyName, normalizeServiceKey(authValue));
    } else if (this.config.authType === "header" && this.config.authKeyName && authValue) {
      headers[this.config.authKeyName] = authValue;
    } else if (this.config.authType === "bearer" && authValue) {
      headers["Authorization"] = `Bearer ${authValue}`;
    }

    const method = this.config.httpMethod ?? "GET";
    let rawText: string;
    if (method === "POST") {
      const searchTerm = params.filters?.[INTERNAL_SEARCH_TERM_KEY];
      const body = buildRequestBody(this.config.requestBodyTemplate, searchTerm);
      if (body && !hasHeader(headers, "content-type")) headers["Content-Type"] = "application/json";
      rawText = await this.apiClient.post(url.toString(), body ?? "", { headers });
    } else {
      rawText = await this.apiClient.get(url.toString(), { headers });
    }

    try {
      return JSON.parse(rawText);
    } catch {
      // JSON이 아니면(XML/텍스트 등) 원본 텍스트를 그대로 감싸서 넘긴다.
      return { __rawText: rawText };
    }
  }

  normalize(rawResponse: unknown): NormalizedResult {
    const rows = extractRowsGeneric(rawResponse);
    return {
      entity: this.entity,
      source: this.source,
      sourceLabel: this.sourceLabel,
      fetchedAt: new Date().toISOString(),
      rows,
      totalCount: rows.length,
    };
  }
}

/** "Key: Value" 형식(한 줄에 하나)의 텍스트를 헤더 객체로 파싱한다. 빈 줄/콜론 없는 줄은 무시한다. */
function parseHeaderLines(text?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
}

/**
 * POST 본문 템플릿의 "{{query}}" 자리에 검색어를 안전하게(JSON 문자열 이스케이프)
 * 치환한다. 템플릿이 없으면 undefined를 반환해 빈 본문으로 요청한다.
 */
function buildRequestBody(template: string | undefined, searchTerm: unknown): string | undefined {
  const trimmed = template?.trim();
  if (!trimmed) return undefined;
  const escaped = searchTerm === undefined ? "" : JSON.stringify(String(searchTerm)).slice(1, -1);
  return trimmed.replace(/\{\{\s*query\s*\}\}/g, escaped);
}

const MAX_SEARCH_DEPTH = 6;

/**
 * 응답 JSON 안에서 "객체로 이뤄진 배열"처럼 보이는 첫 번째 값을 찾아 표로
 * 쓴다 (많은 공공 API가 `items`, `data`, `list`, 또는 `response.body.items`
 * 처럼 한두 단계 감싼 배열을 돌려주는 관행을 이용한 휴리스틱). 못 찾으면
 * 응답 객체 자체를 한 행으로, 그것도 아니면 값 하나짜리 행으로 감싼다 —
 * 항상 최소 한 행은 반환해 사용자가 원본을 확인할 수 있게 한다.
 */
function extractRowsGeneric(raw: unknown): NormalizedRecord[] {
  const arr = findFirstObjectArray(raw, 0);
  if (arr) return arr.map(flattenToRecord);
  if (raw && typeof raw === "object") return [flattenToRecord(raw as Record<string, unknown>)];
  return [{ value: coerce(raw) }];
}

function findFirstObjectArray(value: unknown, depth: number): Record<string, unknown>[] | null {
  if (depth > MAX_SEARCH_DEPTH) return null;
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((v) => v !== null && typeof v === "object" && !Array.isArray(v))) {
      return value as Record<string, unknown>[];
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findFirstObjectArray(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function flattenToRecord(obj: Record<string, unknown>): NormalizedRecord {
  const result: NormalizedRecord = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = coerce(value);
  }
  return result;
}

function coerce(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

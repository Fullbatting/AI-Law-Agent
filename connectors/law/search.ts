import type { ApiConnector } from "../common/types";
import type { NormalizedResult, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";
import { ApiClient } from "../common/apiClient";
import { parseApiResponse } from "../common/parser";

/**
 * 법제처 국가법령정보 공동활용 OpenAPI - 법령 검색 Connector.
 *
 * 엔드포인트: https://www.law.go.kr/DRF/lawSearch.do?target=law
 * (기술기획서 7장 "법제처 API 활용 방향" 참고)
 */
const ENDPOINT = "https://www.law.go.kr/DRF/lawSearch.do";

export class LawSearchConnector implements ApiConnector {
  readonly name = "law_search";
  readonly description = "법령명/키워드로 관련 법령 목록을 검색한다";
  readonly source = "law";
  readonly entity = "law";
  readonly sourceLabel = "법제처 국가법령정보센터";

  constructor(
    private readonly apiClient: ApiClient = new ApiClient(),
    // 법제처 오픈API는 서비스키 대신 신청 시 등록한 이메일 ID(OC)를 사용한다
    private readonly oc: string = process.env.LAW_API_OC ?? ""
  ) {}

  buildParams(dsl: QueryDSL): ConnectorRequestParams {
    const filters: ConnectorRequestParams["filters"] = {};
    for (const f of dsl.filters ?? []) {
      if ((f.field === "query" || f.field === "keyword" || f.field === "name") && "value" in f) {
        filters.query = String(f.value);
      }
      if (f.field === "ministry" && f.operator === "eq") {
        filters.org = String(f.value);
      }
    }
    return { filters, numOfRows: dsl.limit ?? 20, page: 1 };
  }

  async request(params: ConnectorRequestParams): Promise<unknown> {
    if (!this.oc) {
      throw new Error(
        "LAW_API_OC가 설정되지 않았습니다. .env 파일에 법제처 OpenAPI 이용자 ID를 등록하세요."
      );
    }
    const url = new URL(ENDPOINT);
    url.searchParams.set("OC", this.oc);
    url.searchParams.set("target", "law");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("display", String(params.numOfRows ?? 20));
    url.searchParams.set("page", String(params.page ?? 1));
    for (const [key, value] of Object.entries(params.filters ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    const rawText = await this.apiClient.get(url.toString());
    return parseApiResponse(rawText);
  }

  normalize(rawResponse: unknown): NormalizedResult {
    const obj = rawResponse as Record<string, unknown>;
    const container = (obj?.["LawSearch"] as Record<string, unknown>) ?? {};
    const lawField = container["law"];
    const items = Array.isArray(lawField)
      ? (lawField as Record<string, unknown>[])
      : lawField
        ? [lawField as Record<string, unknown>]
        : [];

    const rows = items.map((item) => ({
      law_id: str(item["법령일련번호"]),
      name: str(item["법령명한글"]) ?? "",
      law_type: str(item["법령구분명"]),
      ministry: str(item["소관부처명"]),
      promulgation_date: str(item["공포일자"]),
      effective_date: str(item["시행일자"]),
      detail_url: str(item["법령상세링크"]),
    }));

    return {
      entity: this.entity,
      source: this.source,
      sourceLabel: this.sourceLabel,
      fetchedAt: new Date().toISOString(),
      rows,
      totalCount: num(container["totalCnt"]) ?? rows.length,
    };
  }
}

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

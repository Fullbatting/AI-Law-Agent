import type { ApiConnector } from "../common/types";
import type { NormalizedResult, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";
import { ApiClient } from "../common/apiClient";
import { parseApiResponse, isPublicDataApiError } from "../common/parser";
import { regionNameToSidoCode } from "../../data/dictionaries/regionCodes";
import { hospitalTypeNameToCode } from "../../data/dictionaries/hospitalTypeCodes";

/**
 * HIRA(건강보험심사평가원) 병원정보서비스 Connector.
 * API: getHospBasisList (병원기본정보 조회)
 *
 * 공공데이터포털 문서 기준 엔드포인트:
 *   http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList
 */
const ENDPOINT =
  "https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList";

export class HiraHospitalConnector implements ApiConnector {
  readonly name = "hira_hospital_search";
  readonly description = "지역·종별 조건으로 병원 기본정보를 검색한다";
  readonly source = "hira";
  readonly entity = "hospital";
  readonly sourceLabel = "건강보험심사평가원(HIRA)";

  constructor(
    private readonly apiClient: ApiClient = new ApiClient(),
    private readonly serviceKey: string = process.env.HIRA_SERVICE_KEY ?? ""
  ) {}

  buildParams(dsl: QueryDSL): ConnectorRequestParams {
    const filters: ConnectorRequestParams["filters"] = {};
    for (const f of dsl.filters ?? []) {
      if (f.field === "region" && f.operator === "eq") {
        const code = regionNameToSidoCode(String(f.value));
        if (code) filters.sidoCd = code;
      }
      if (f.field === "hospital_type" && f.operator === "eq") {
        const code = hospitalTypeNameToCode(String(f.value));
        if (code) filters.clCd = code;
      }
      if (f.field === "name" && (f.operator === "eq" || f.operator === "contains")) {
        filters.yadmNm = String(f.value);
      }
    }
    return {
      filters,
      numOfRows: dsl.limit ?? 100,
      page: 1,
    };
  }

  async request(params: ConnectorRequestParams): Promise<unknown> {
    if (!this.serviceKey) {
      throw new Error(
        "HIRA_SERVICE_KEY가 설정되지 않았습니다. .env 파일에 공공데이터포털 서비스키를 등록하세요."
      );
    }
    const url = new URL(ENDPOINT);
    url.searchParams.set("serviceKey", this.serviceKey);
    url.searchParams.set("_type", "json");
    url.searchParams.set("numOfRows", String(params.numOfRows ?? 100));
    url.searchParams.set("pageNo", String(params.page ?? 1));
    for (const [key, value] of Object.entries(params.filters ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    const rawText = await this.apiClient.get(url.toString());
    const parsed = parseApiResponse(rawText);
    const { isError, message } = isPublicDataApiError(parsed);
    if (isError) {
      throw new Error(`HIRA API 오류: ${message}`);
    }
    return parsed;
  }

  normalize(rawResponse: unknown): NormalizedResult {
    const body = extractBody(rawResponse);
    const items = extractItems(body);

    const rows = items.map((item) => ({
      name: str(item.yadmNm),
      hospital_type: str(item.clCdNm),
      region: str(item.sidoCdNm),
      district: str(item.sgguCdNm),
      address: str(item.addr),
      phone: str(item.telno),
      doctor_count: num(item.drTotCnt),
      established_at: str(item.estbDd),
      emergency_room: boolFromYn(item.emyDayYn),
      ykiho: str(item.ykiho),
    }));

    return {
      entity: this.entity,
      source: this.source,
      sourceLabel: this.sourceLabel,
      fetchedAt: new Date().toISOString(),
      rows,
      totalCount: num(body?.totalCount) ?? rows.length,
    };
  }
}

// ── 응답 파싱 헬퍼 ────────────────────────────────────────────────────────
type ApiItem = Record<string, unknown>;

function extractBody(raw: unknown): Record<string, unknown> | undefined {
  const obj = raw as Record<string, unknown>;
  const response = obj?.["response"] as Record<string, unknown> | undefined;
  return response?.["body"] as Record<string, unknown> | undefined;
}

function extractItems(body: Record<string, unknown> | undefined): ApiItem[] {
  const itemsWrapper = body?.["items"];
  if (!itemsWrapper) return [];
  const item = (itemsWrapper as Record<string, unknown>)["item"];
  if (!item) return [];
  return Array.isArray(item) ? (item as ApiItem[]) : [item as ApiItem];
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

function boolFromYn(v: unknown): boolean | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim().toUpperCase();
  if (s === "Y" || s === "1" || s === "TRUE") return true;
  if (s === "N" || s === "0" || s === "FALSE") return false;
  return null;
}

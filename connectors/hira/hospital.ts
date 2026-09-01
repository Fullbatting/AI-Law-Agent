import type { ApiConnector } from "../common/types";
import type { NormalizedResult, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";
import { ApiClient, ApiRequestError } from "../common/apiClient";
import { normalizeServiceKey } from "../common/serviceKey";
import { parseApiResponse, isPublicDataApiError } from "../common/parser";
import { validateWithSchema } from "../common/validator";
import { hiraHospitalItemSchema, type HiraHospitalItem } from "../../data/schemas/hospital.schema";
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
    /**
     * 함수로 받는 이유: 사용자가 설정 화면에서 키를 나중에 입력/변경해도
     * (SettingsManager.getHiraServiceKey) 앱 재시작 없이 다음 호출부터
     * 바로 반영되도록 하기 위함이다. 생성 시점에 문자열로 고정하면 안 된다.
     */
    private readonly getServiceKey: () => string = () => process.env.HIRA_SERVICE_KEY ?? ""
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
    const serviceKey = this.getServiceKey();
    if (!serviceKey) {
      throw new Error(
        "HIRA_SERVICE_KEY가 설정되지 않았습니다. 앱의 설정 화면(또는 .env 파일)에 공공데이터포털 서비스키를 등록하세요."
      );
    }
    const url = new URL(ENDPOINT);
    url.searchParams.set("serviceKey", normalizeServiceKey(serviceKey));
    url.searchParams.set("_type", "json");
    url.searchParams.set("numOfRows", String(params.numOfRows ?? 100));
    url.searchParams.set("pageNo", String(params.page ?? 1));
    for (const [key, value] of Object.entries(params.filters ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    let rawText: string;
    try {
      rawText = await this.apiClient.get(url.toString());
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        throw new Error(
          "HIRA API가 서비스키를 거부했습니다(HTTP 403). 공공데이터포털에서 " +
            "'일반 인증키(Encoding)'가 아닌 '일반 인증키(Decoding)' 값을 " +
            "설정 화면에 입력했는지 확인하세요. 방금 활용신청을 했다면 " +
            "승인까지 몇 분~몇 시간이 걸릴 수 있으니 잠시 후 다시 시도하세요."
        );
      }
      throw err;
    }
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

function extractBody(raw: unknown): Record<string, unknown> | undefined {
  const obj = raw as Record<string, unknown>;
  const response = obj?.["response"] as Record<string, unknown> | undefined;
  return response?.["body"] as Record<string, unknown> | undefined;
}

/**
 * 원본 item 배열을 꺼낸 뒤 각 항목을 hiraHospitalItemSchema로 검증한다.
 * HIRA가 응답 필드를 바꾸는 등 예상과 다른 항목은 건너뛰고 경고만 남긴다
 * (기술기획서 25장 "API 응답 형식 변경" 리스크 대응 — 한 항목이 깨졌다고
 * 전체 조회가 실패하지 않도록 한다).
 */
function extractItems(body: Record<string, unknown> | undefined): HiraHospitalItem[] {
  const itemsWrapper = body?.["items"];
  if (!itemsWrapper) return [];
  const raw = (itemsWrapper as Record<string, unknown>)["item"];
  if (!raw) return [];
  const rawItems = Array.isArray(raw) ? raw : [raw];

  const items: HiraHospitalItem[] = [];
  for (const rawItem of rawItems) {
    const result = validateWithSchema(hiraHospitalItemSchema, rawItem);
    if (result.ok && result.data) {
      items.push(result.data);
    } else {
      console.warn(`[hira_hospital_search] 예상과 다른 형식의 항목을 건너뜁니다: ${result.error}`);
    }
  }
  return items;
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

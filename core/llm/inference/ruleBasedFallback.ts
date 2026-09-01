import type { SlmRuntime, SlmCompletionRequest, SlmSummarizeRequest } from "./types";
import type { QueryDSL, QueryPlan } from "../../query/dsl/types";
import type { CustomApiConfig } from "../../settings/settingsManager";
import { REGION_NAME_TO_SIDO_CODE } from "../../../data/dictionaries/regionCodes";
import { HOSPITAL_TYPE_NAME_TO_CODE } from "../../../data/dictionaries/hospitalTypeCodes";
import { buildTemplateSummary } from "../prompt/summarizePrompt";

const FIELD_ALIASES: Record<string, string> = {
  병원명: "name",
  이름: "name",
  종별: "hospital_type",
  지역: "region",
  주소: "address",
  전화번호: "phone",
  연락처: "phone",
  의사수: "doctor_count",
  개설일: "established_at",
  응급실: "emergency_room",
};

/**
 * 실제 GGUF 모델(LlamaCppRuntime) 없이도 Query Planner → Validator →
 * Tool Router → Data Processor 전체 파이프라인을 개발/테스트할 수 있도록
 * 만든 규칙 기반 폴백 SLM.
 *
 * 파인튜닝 이전 단계(기술기획서 17.1절)에서 "Base SLM + Prompt + Schema"
 * 조합이 실제로 어떤 JSON을 만들어내야 하는지 보여주는 참고 구현이기도 하다.
 * llama.cpp 서버가 뜨어있지 않을 때 자동으로 이 런타임으로 대체된다.
 */
export class RuleBasedFallbackRuntime implements SlmRuntime {
  readonly name = "rule-based-fallback";

  /**
   * @param getCustomApis 설정 화면에서 등록한 커스텀 API 목록을 조회하는 함수.
   * GGUF 모델이 없을 때도(진짜 언어 이해 없이) 어느 API로 질문을 보낼지
   * 자동으로 추정하기 위해 쓴다 — buildPlan() 참고. 등록된 게 없으면(기본값)
   * 기존과 동일하게 HIRA/법제처 두 가지만 규칙으로 구분한다.
   */
  constructor(private readonly getCustomApis: () => CustomApiConfig[] = () => []) {}

  async complete(request: SlmCompletionRequest): Promise<string> {
    const plan = this.buildPlan(request.userText);
    return JSON.stringify(plan);
  }

  /** 실제 언어 이해 없이 고정 템플릿으로 결과 건수/출처만 요약한다. */
  async summarize(request: SlmSummarizeRequest): Promise<string> {
    return buildTemplateSummary(request.results);
  }

  /**
   * 어느 API로 보낼지 자동으로 정한다(질문 1 "1이 가능하면 1"에 대한 규칙
   * 기반 폴백 쪽 구현):
   * 1) 질문에 등록된 커스텀 API 이름이 그대로 들어있으면 그 API로 확정한다
   *    — 사용자가 "OO API로 찾아줘"처럼 직접 지정한 것과 동일한 효과라
   *    자동 분류와 수동 지정을 자연스럽게 합친다.
   * 2) 법령 관련 키워드가 있으면 법제처로 보낸다.
   * 3) 그 외엔 등록된 커스텀 API들의 이름+설명과 질문의 단어 겹침 점수가
   *    가장 높은 것을 고른다(뚜렷하게 겹치는 게 있을 때만 — 애매하면
   *    잘못 추측하는 대신 3순위로 밀어둔다).
   * 4) 그래도 없으면 기본값인 병원 검색으로 처리한다.
   * 실제 GGUF 모델이 로드되어 있으면 이 규칙 대신 모델이 시스템 프롬프트에
   * 나열된 모든 소스(커스텀 API 포함, core/tools/registry.ts describeForPrompt
   * 참고)를 보고 직접 판단하므로 훨씬 정확하다.
   */
  private buildPlan(userText: string): QueryPlan {
    const customApis = this.getCustomApis();

    const byName = customApis.find((api) => api.name.trim() && userText.includes(api.name.trim()));
    if (byName) return this.buildCustomPlan(byName, userText);

    if (/법령|법률|위반|조문|법제처/.test(userText)) {
      return this.buildLawPlan(userText);
    }

    const byKeyword = bestMatchingCustomApi(userText, customApis);
    if (byKeyword) return this.buildCustomPlan(byKeyword, userText);

    return this.buildHospitalPlan(userText);
  }

  private buildCustomPlan(api: CustomApiConfig, userText: string): QueryPlan {
    const keyword = extractGenericKeyword(userText, api.name);
    const dsl: QueryDSL = {
      source: `custom:${api.id}`,
      operation: "search",
      entity: "item",
      filters: keyword ? [{ field: "query", operator: "eq", value: keyword }] : [],
      limit: 50,
    };
    return { intent: `custom_${api.id}_search`, queries: [dsl] };
  }

  private buildHospitalPlan(userText: string): QueryPlan {
    const dsl: QueryDSL = {
      source: "hira",
      operation: "search",
      entity: "hospital",
      filters: [],
      limit: 50,
    };

    for (const region of Object.keys(REGION_NAME_TO_SIDO_CODE)) {
      if (userText.includes(region)) {
        dsl.filters!.push({ field: "region", operator: "eq", value: region });
        break;
      }
    }
    for (const type of Object.keys(HOSPITAL_TYPE_NAME_TO_CODE)) {
      if (userText.includes(type)) {
        dsl.filters!.push({ field: "hospital_type", operator: "eq", value: type });
        break;
      }
    }
    if (/응급실/.test(userText)) {
      dsl.filters!.push({ field: "emergency_room", operator: "eq", value: true });
    }

    const select = extractSelectFields(userText);
    if (select.length > 0) dsl.select = select;

    if (/가나다순|이름순|오름차순/.test(userText)) {
      dsl.sort = { field: "name", order: "asc" };
    } else if (/내림차순/.test(userText)) {
      dsl.sort = { field: "name", order: "desc" };
    }

    const limitMatch = userText.match(/(\d+)\s*개/);
    if (limitMatch) dsl.limit = Number(limitMatch[1]);

    if (/지역별.*(수|개수|집계)/.test(userText)) {
      dsl.group_by = ["region"];
      dsl.aggregate = [{ fn: "count", as: "count" }];
      dsl.select = undefined;
    }

    if (/엑셀|excel/i.test(userText)) {
      dsl.export_format = "excel";
    } else if (/csv/i.test(userText)) {
      dsl.export_format = "csv";
    }

    return {
      intent: "hospital_search",
      queries: [dsl],
    };
  }

  private buildLawPlan(userText: string): QueryPlan {
    const keyword = extractLawKeyword(userText);
    const dsl: QueryDSL = {
      source: "law",
      operation: "search",
      entity: "law",
      filters: keyword ? [{ field: "query", operator: "eq", value: keyword }] : [],
      limit: 20,
    };
    return { intent: "law_search", queries: [dsl] };
  }
}

function extractSelectFields(userText: string): string[] {
  const fields: string[] = [];
  for (const [alias, field] of Object.entries(FIELD_ALIASES)) {
    if (userText.includes(alias) && !fields.includes(field)) fields.push(field);
  }
  // "~만 보여줘" 패턴이 없으면 부분 컬럼 선택 의도가 아닐 수 있으므로,
  // 명시적으로 "만"이 포함된 경우에만 select를 좁힌다.
  return /만\s*(보여|표시|출력)/.test(userText) ? fields : [];
}

function extractLawKeyword(userText: string): string | null {
  const cleaned = userText
    .replace(/(찾아줘|알려줘|검색해줘|보여줘|해줘|법령|법률|위반할\s*수\s*있어\?|위반|관련된?|적용되는)/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words.slice(0, 3).join(" ") : null;
}

/** 질문 문장을 대략적인 "단어" 단위로 쪼갠다(공백/구두점 기준, 2글자 미만은 잡음으로 버린다). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/**
 * 등록된 커스텀 API 중 질문과 이름+설명의 단어가 가장 많이 겹치는 것을 고른다.
 * 겹치는 단어가 최소 2개 이상일 때만 채택한다 — 1개만 우연히 겹쳐도 채택하면
 * 상관없는 질문을 엉뚱한 API로 잘못 보낼 위험이 커지기 때문이다.
 */
function bestMatchingCustomApi(userText: string, customApis: CustomApiConfig[]): CustomApiConfig | null {
  if (customApis.length === 0) return null;
  const questionTokens = new Set(tokenize(userText));
  if (questionTokens.size === 0) return null;

  let best: { api: CustomApiConfig; score: number } | null = null;
  for (const api of customApis) {
    const corpus = `${api.name} ${api.description ?? ""}`;
    const score = tokenize(corpus).filter((token) => questionTokens.has(token)).length;
    if (score > 0 && (!best || score > best.score)) best = { api, score };
  }
  return best && best.score >= 2 ? best.api : null;
}

/** 커스텀 API용 검색어 추출: 흔한 요청 어미와 API 이름 자체를 지우고 남은 단어들을 쓴다. */
function extractGenericKeyword(userText: string, apiName: string): string | null {
  const withoutName = apiName.trim() ? userText.split(apiName.trim()).join(" ") : userText;
  const cleaned = withoutName
    .replace(/(찾아줘|알려줘|검색해줘|보여줘|해줘|API|api|관련된?|에\s*대해|에\s*대한)/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words.slice(0, 5).join(" ") : null;
}

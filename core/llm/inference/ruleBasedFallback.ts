import type { SlmRuntime, SlmCompletionRequest } from "./types";
import type { QueryDSL, QueryPlan } from "../../query/dsl/types";
import { REGION_NAME_TO_SIDO_CODE } from "../../../data/dictionaries/regionCodes";
import { HOSPITAL_TYPE_NAME_TO_CODE } from "../../../data/dictionaries/hospitalTypeCodes";

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

  async complete(request: SlmCompletionRequest): Promise<string> {
    const plan = this.buildPlan(request.userText);
    return JSON.stringify(plan);
  }

  private buildPlan(userText: string): QueryPlan {
    if (/법령|법률|위반|조문|법제처/.test(userText)) {
      return this.buildLawPlan(userText);
    }
    return this.buildHospitalPlan(userText);
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

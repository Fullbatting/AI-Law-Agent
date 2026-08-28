import { z } from "zod";
import { queryPlanSchema } from "../../llm/schemas/queryDsl.schema";
import type { QueryPlan } from "../dsl/types";

export interface ValidationSuccess {
  ok: true;
  data: QueryPlan;
}

export interface ValidationFailure {
  ok: false;
  /** SLM에게 재생성을 요청할 때 그대로 붙여줄 수 있는 사람이 읽을 수 있는 오류 메시지 */
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * SLM이 생성한 원시 JSON(문자열 또는 파싱된 객체)을 QueryPlan 스키마로 검증한다.
 * 실패 시 SLM에게 재요청할 수 있도록 사람이 읽을 수 있는 오류 목록을 반환한다.
 */
export function validateQueryPlan(raw: unknown): ValidationResult {
  const result = queryPlanSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data as QueryPlan };
  }
  return { ok: false, errors: formatZodErrors(result.error) };
}

/** SLM이 JSON 문자열(코드블록 포함 가능)을 반환한 경우를 대비한 파싱 + 검증 */
export function parseAndValidateQueryPlan(rawText: string): ValidationResult {
  const jsonText = extractJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return {
      ok: false,
      errors: [`SLM 출력이 올바른 JSON이 아닙니다: ${(err as Error).message}`],
    };
  }
  return validateQueryPlan(parsed);
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
}

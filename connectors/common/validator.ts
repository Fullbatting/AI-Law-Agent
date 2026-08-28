import type { z } from "zod";

export interface ConnectorValidationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Connector가 정규화하기 전에 원본 API 응답 구조를 검증할 때 사용한다.
 * (기술기획서 25장 "API 응답 형식 변경" 리스크 대응: 스키마가 깨지면
 * 여기서 즉시 감지해 Connector별 정규화 로직이 조용히 잘못된 값을
 * 만들어내는 것을 막는다.)
 */
export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown
): ConnectorValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

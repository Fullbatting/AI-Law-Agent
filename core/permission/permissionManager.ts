import type { QueryDSL } from "../query/dsl/types";
import type { ToolRegistry } from "../tools/registry";

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * SLM이 생성한 QueryDSL이 실제로 실행 가능한지 마지막으로 한 번 더 확인한다.
 * - 등록되지 않은 source/entity 조합 차단
 * - limit이 과도하게 큰 요청 차단
 * (기술기획서 25장 "잘못된 API 선택" / "API 호출량 제한" 리스크 대응)
 */
export class PermissionManager {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly maxLimit: number = 1000
  ) {}

  check(dsl: QueryDSL): PermissionCheckResult {
    if (!this.registry.has(dsl.source, dsl.entity)) {
      return {
        allowed: false,
        reason: `허용되지 않은 데이터 소스입니다: source="${dsl.source}", entity="${dsl.entity}"`,
      };
    }
    if (dsl.limit !== undefined && dsl.limit > this.maxLimit) {
      return {
        allowed: false,
        reason: `한 번에 요청할 수 있는 최대 건수(${this.maxLimit})를 초과했습니다.`,
      };
    }
    if (dsl.join) {
      const nested = this.check(dsl.join.with);
      if (!nested.allowed) return nested;
    }
    return { allowed: true };
  }
}

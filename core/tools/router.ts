import type { QueryDSL } from "../query/dsl/types";
import type { NormalizedResult } from "../types/domain";
import { ToolRegistry } from "./registry";
import { PermissionManager } from "../permission/permissionManager";
import { runPipeline } from "../dataProcessing/pipeline";
import { applyJoin } from "../dataProcessing/join";

export interface ToolExecutionResult {
  ok: boolean;
  result?: NormalizedResult;
  error?: string;
}

/**
 * Tool Router — 허용된 Tool(Connector)을 선택해 실행하고,
 * Data Processor 파이프라인까지 적용한 최종 결과를 돌려준다.
 * (기술기획서 3장, 6장 참고)
 */
export class ToolRouter {
  constructor(
    private readonly registry: ToolRegistry = new ToolRegistry(),
    private readonly permissions: PermissionManager = new PermissionManager(registry)
  ) {}

  async execute(dsl: QueryDSL): Promise<ToolExecutionResult> {
    const permission = this.permissions.check(dsl);
    if (!permission.allowed) {
      return { ok: false, error: permission.reason };
    }

    try {
      const primary = await this.fetchNormalized(dsl);

      let rows = primary.rows;
      if (dsl.join) {
        const secondary = await this.fetchNormalized(dsl.join.with);
        rows = applyJoin(rows, secondary.rows, dsl.join.on);
      }

      const processedRows = runPipeline(rows, dsl);

      return {
        ok: true,
        result: { ...primary, rows: processedRows },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async fetchNormalized(dsl: QueryDSL): Promise<NormalizedResult> {
    const connector = this.registry.get(dsl.source, dsl.entity);
    if (!connector) {
      throw new Error(`Connector를 찾을 수 없습니다: ${dsl.source}/${dsl.entity}`);
    }
    const params = connector.buildParams(dsl);
    const rawResponse = await connector.request(params);
    return connector.normalize(rawResponse);
  }
}

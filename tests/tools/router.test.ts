import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../core/tools/registry";
import { ToolRouter } from "../../core/tools/router";
import { PermissionManager } from "../../core/permission/permissionManager";
import type { ApiConnector } from "../../connectors/common/types";
import type { NormalizedResult, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";

/** 테스트 전용 가짜 Connector: 실제 네트워크 호출 없이 고정 데이터를 돌려준다 */
class FakeHospitalConnector implements ApiConnector {
  readonly name = "fake_hospital_search";
  readonly description = "테스트용";
  readonly source = "fake";
  readonly entity = "hospital";
  readonly sourceLabel = "테스트 소스";

  buildParams(): ConnectorRequestParams {
    return {};
  }

  async request(): Promise<unknown> {
    return [
      { name: "가나병원", region: "서울" },
      { name: "다라병원", region: "부산" },
    ];
  }

  normalize(rawResponse: unknown): NormalizedResult {
    return {
      entity: this.entity,
      source: this.source,
      sourceLabel: this.sourceLabel,
      fetchedAt: new Date().toISOString(),
      rows: rawResponse as NormalizedResult["rows"],
    };
  }
}

describe("ToolRouter", () => {
  it("등록된 Connector를 실행하고 Data Processor 파이프라인을 적용한다", async () => {
    const registry = new ToolRegistry([new FakeHospitalConnector()]);
    const router = new ToolRouter(registry, new PermissionManager(registry));

    const dsl: QueryDSL = {
      source: "fake",
      operation: "search",
      entity: "hospital",
      filters: [{ field: "region", operator: "eq", value: "서울" }],
    };

    const result = await router.execute(dsl);
    expect(result.ok).toBe(true);
    expect(result.result?.rows).toEqual([{ name: "가나병원", region: "서울" }]);
  });

  it("등록되지 않은 source/entity는 Permission 단계에서 차단한다", async () => {
    const registry = new ToolRegistry([new FakeHospitalConnector()]);
    const router = new ToolRouter(registry, new PermissionManager(registry));

    const dsl: QueryDSL = { source: "unknown", operation: "search", entity: "hospital" };
    const result = await router.execute(dsl);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/허용되지 않은/);
  });
});

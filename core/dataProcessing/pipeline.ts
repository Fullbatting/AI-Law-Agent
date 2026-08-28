import type { NormalizedRecord } from "../types/domain";
import type { QueryDSL } from "../query/dsl/types";
import { applyFilters } from "./filter";
import { applySort } from "./sort";
import { applySelect, applyLimit } from "./select";
import { applyGroupAndAggregate } from "./group";

/**
 * QueryDSL에 담긴 filter/group/aggregate/sort/select/limit을 순서대로 적용한다.
 * join은 두 Connector 결과가 모두 필요하므로 QueryPlanner/ToolRouter 레벨에서
 * applyJoin(core/dataProcessing/join.ts)을 먼저 실행한 뒤 이 파이프라인에 넘긴다.
 */
export function runPipeline(rows: NormalizedRecord[], dsl: QueryDSL): NormalizedRecord[] {
  let result = applyFilters(rows, dsl.filters);
  result = applyGroupAndAggregate(result, dsl.group_by, dsl.aggregate);
  result = applySort(result, dsl.sort);
  result = applySelect(result, dsl.select);
  result = applyLimit(result, dsl.limit);
  return result;
}

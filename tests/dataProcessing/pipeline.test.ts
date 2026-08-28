import { describe, expect, it } from "vitest";
import { runPipeline } from "../../core/dataProcessing/pipeline";
import { applyJoin } from "../../core/dataProcessing/join";
import type { NormalizedRecord } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";

const hospitals: NormalizedRecord[] = [
  { name: "가나병원", region: "서울", hospital_type: "종합병원", doctor_count: 30 },
  { name: "다라병원", region: "서울", hospital_type: "병원", doctor_count: 10 },
  { name: "마바병원", region: "부산", hospital_type: "종합병원", doctor_count: 20 },
];

function baseDsl(overrides: Partial<QueryDSL>): QueryDSL {
  return { source: "hira", operation: "search", entity: "hospital", ...overrides };
}

describe("runPipeline", () => {
  it("filter로 지역을 좁힌다", () => {
    const dsl = baseDsl({ filters: [{ field: "region", operator: "eq", value: "서울" }] });
    const result = runPipeline(hospitals, dsl);
    expect(result).toHaveLength(2);
  });

  it("select로 컬럼을 제한한다", () => {
    const dsl = baseDsl({ select: ["name", "region"] });
    const result = runPipeline(hospitals, dsl);
    expect(Object.keys(result[0]).sort()).toEqual(["name", "region"]);
  });

  it("sort와 limit을 함께 적용한다", () => {
    const dsl = baseDsl({ sort: { field: "name", order: "asc" }, limit: 2 });
    const result = runPipeline(hospitals, dsl);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("가나병원");
  });

  it("group_by + count aggregate로 지역별 병원 수를 계산한다", () => {
    const dsl = baseDsl({ group_by: ["region"], aggregate: [{ fn: "count", as: "count" }] });
    const result = runPipeline(hospitals, dsl);
    const seoul = result.find((r) => r.region === "서울");
    expect(seoul?.count).toBe(2);
  });

  it("avg aggregate를 계산한다", () => {
    const dsl = baseDsl({
      group_by: ["region"],
      aggregate: [{ fn: "avg", field: "doctor_count", as: "avg_doctors" }],
    });
    const result = runPipeline(hospitals, dsl);
    const seoul = result.find((r) => r.region === "서울");
    expect(seoul?.avg_doctors).toBe(20);
  });

  it("contains 연산자로 부분 문자열을 검색한다", () => {
    const dsl = baseDsl({ filters: [{ field: "name", operator: "contains", value: "가나" }] });
    const result = runPipeline(hospitals, dsl);
    expect(result).toHaveLength(1);
  });

  it("여러 필드로 group_by 해도 각 필드 값을 정확히 복원한다", () => {
    const dsl = baseDsl({
      group_by: ["region", "hospital_type"],
      aggregate: [{ fn: "count", as: "count" }],
    });
    const result = runPipeline(hospitals, dsl);

    expect(result).toHaveLength(3);
    const seoulGeneral = result.find((r) => r.region === "서울" && r.hospital_type === "종합병원");
    expect(seoulGeneral?.count).toBe(1);
  });
});

describe("applyJoin", () => {
  it("공통 필드로 두 데이터셋을 결합한다", () => {
    const left: NormalizedRecord[] = [{ region: "서울", hospitals: 2 }];
    const right: NormalizedRecord[] = [{ region: "서울", cases: 100 }];
    const joined = applyJoin(left, right, "region");
    expect(joined).toEqual([{ region: "서울", hospitals: 2, cases: 100 }]);
  });

  it("매칭되지 않는 행은 결과에서 제외한다", () => {
    const left: NormalizedRecord[] = [{ region: "부산", hospitals: 1 }];
    const right: NormalizedRecord[] = [{ region: "서울", cases: 100 }];
    const joined = applyJoin(left, right, "region");
    expect(joined).toHaveLength(0);
  });
});

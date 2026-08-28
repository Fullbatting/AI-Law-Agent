import type { NormalizedRecord } from "../types/domain";

/**
 * 두 결과 집합을 공통 필드(on) 기준으로 결합한다 (inner join).
 * 예: "서울 병원정보와 질병정보를 비교해줘" 처럼 두 Connector 결과를 이어 붙일 때 사용.
 */
export function applyJoin(
  left: NormalizedRecord[],
  right: NormalizedRecord[],
  on: string
): NormalizedRecord[] {
  const rightByKey = new Map<string, NormalizedRecord[]>();
  for (const row of right) {
    const key = String(row[on] ?? "");
    const bucket = rightByKey.get(key) ?? [];
    bucket.push(row);
    rightByKey.set(key, bucket);
  }

  const joined: NormalizedRecord[] = [];
  for (const leftRow of left) {
    const key = String(leftRow[on] ?? "");
    const matches = rightByKey.get(key);
    if (!matches) continue;
    for (const rightRow of matches) {
      joined.push({ ...leftRow, ...prefixConflicts(leftRow, rightRow, on) });
    }
  }
  return joined;
}

function prefixConflicts(
  left: NormalizedRecord,
  right: NormalizedRecord,
  joinKey: string
): NormalizedRecord {
  const out: NormalizedRecord = {};
  for (const [key, value] of Object.entries(right)) {
    // join 기준 필드는 left 쪽 값과 동일하므로 그대로 두고 중복 표시하지 않는다.
    if (key === joinKey) continue;
    out[key in left ? `right_${key}` : key] = value;
  }
  return out;
}

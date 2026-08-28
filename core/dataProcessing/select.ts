import type { NormalizedRecord } from "../types/domain";

export function applySelect(
  rows: NormalizedRecord[],
  select: string[] | undefined
): NormalizedRecord[] {
  if (!select || select.length === 0) return rows;
  return rows.map((row) => {
    const picked: NormalizedRecord = {};
    for (const field of select) {
      if (field in row) picked[field] = row[field];
    }
    return picked;
  });
}

export function applyLimit(rows: NormalizedRecord[], limit: number | undefined): NormalizedRecord[] {
  if (!limit || limit <= 0) return rows;
  return rows.slice(0, limit);
}

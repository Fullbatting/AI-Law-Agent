import type { NormalizedRecord } from "../types/domain";
import type { QuerySort } from "../query/dsl/types";

export function applySort(
  rows: NormalizedRecord[],
  sort: QuerySort | null | undefined
): NormalizedRecord[] {
  if (!sort) return rows;
  const { field, order } = sort;
  const sorted = [...rows].sort((a, b) => compare(a[field], b[field]));
  return order === "desc" ? sorted.reverse() : sorted;
}

function compare(a: unknown, b: unknown): number {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn) && a !== null && b !== null) {
    return an - bn;
  }
  return String(a ?? "").localeCompare(String(b ?? ""), "ko");
}

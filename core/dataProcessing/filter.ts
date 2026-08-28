import type { NormalizedRecord } from "../types/domain";
import type { QueryFilter } from "../query/dsl/types";

export function applyFilters(
  rows: NormalizedRecord[],
  filters: QueryFilter[] | undefined
): NormalizedRecord[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matches(row[f.field], f)));
}

function matches(cellValue: NormalizedRecord[string], filter: QueryFilter): boolean {
  const { operator, value } = filter;
  switch (operator) {
    case "eq":
      return String(cellValue ?? "").toLowerCase() === String(value).toLowerCase();
    case "ne":
      return String(cellValue ?? "").toLowerCase() !== String(value).toLowerCase();
    case "contains":
      return String(cellValue ?? "")
        .toLowerCase()
        .includes(String(value).toLowerCase());
    case "gt":
      return numeric(cellValue) > numeric(value);
    case "gte":
      return numeric(cellValue) >= numeric(value);
    case "lt":
      return numeric(cellValue) < numeric(value);
    case "lte":
      return numeric(cellValue) <= numeric(value);
    case "in":
      return Array.isArray(value)
        ? value.some((v) => String(v).toLowerCase() === String(cellValue ?? "").toLowerCase())
        : false;
    default:
      return true;
  }
}

function numeric(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

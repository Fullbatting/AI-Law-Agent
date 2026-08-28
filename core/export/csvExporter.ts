import fs from "node:fs";
import type { NormalizedRecord } from "../types/domain";

/**
 * NormalizedRecord 배열을 CSV 문자열로 변환한다.
 * 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다.
 */
export function toCsvString(rows: NormalizedRecord[]): string {
  if (rows.length === 0) return "﻿";
  const columns = Object.keys(rows[0]);
  const header = columns.map(escapeCell).join(",");
  const lines = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(","));
  return "﻿" + [header, ...lines].join("\r\n");
}

export function writeCsvFile(rows: NormalizedRecord[], filePath: string): void {
  fs.writeFileSync(filePath, toCsvString(rows), "utf8");
}

function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

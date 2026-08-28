import ExcelJS from "exceljs";
import type { NormalizedRecord, NormalizedResult } from "../types/domain";

/**
 * 검색 결과를 Excel(.xlsx) 파일로 저장한다.
 * 데이터 출처와 조회 시각을 함께 기록한다 (기술기획서 13장 UI 결과 표현 방식 참고).
 */
export async function writeExcelFile(result: NormalizedResult, filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(result.entity || "결과");

  const rows = result.rows;
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  sheet.columns = columns.map((col) => ({ header: col, key: col, width: Math.max(col.length + 4, 14) }));
  for (const row of rows) {
    sheet.addRow(row as NormalizedRecord);
  }
  sheet.getRow(1).font = { bold: true };

  const metaSheet = workbook.addWorksheet("메타정보");
  metaSheet.addRows([
    ["데이터 출처", result.sourceLabel],
    ["조회 시각", result.fetchedAt],
    ["총 건수", result.totalCount ?? rows.length],
  ]);

  await workbook.xlsx.writeFile(filePath);
}

import React from "react";
import type { NormalizedResult } from "../../../../core/types/domain";

interface Props {
  result: NormalizedResult;
}

export function ResultTable({ result }: Props): JSX.Element {
  const columns = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];

  async function handleExport(format: "excel" | "csv") {
    const response =
      format === "excel"
        ? await window.publicDataAI.exportExcel(result)
        : await window.publicDataAI.exportCsv(result);
    if (!response.ok && response.error !== "취소되었습니다.") {
      // eslint-disable-next-line no-alert
      alert(`내보내기 실패: ${response.error}`);
    }
  }

  return (
    <div className="result-card">
      <div className="result-table-wrapper">
        <table className="result-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{formatCell(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="result-footer">
        <span>
          데이터 출처: {result.sourceLabel} · 조회시간: {formatDate(result.fetchedAt)} · 총{" "}
          {result.totalCount ?? result.rows.length}건
        </span>
        <div className="export-buttons">
          <button type="button" onClick={() => handleExport("excel")}>
            엑셀로 저장
          </button>
          <button type="button" onClick={() => handleExport("csv")}>
            CSV로 저장
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "있음" : "없음";
  return String(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

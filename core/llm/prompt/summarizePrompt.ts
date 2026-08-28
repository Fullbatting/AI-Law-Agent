import type { NormalizedResult } from "../../types/domain";

/** 프롬프트에 원본 데이터를 너무 많이 넣지 않도록 결과당 표본으로 넣는 최대 행 수 */
const MAX_SAMPLE_ROWS = 10;

/**
 * 결과 요약(summarize) 전용 시스템 프롬프트.
 * 핵심 제약: SLM은 표/원본 데이터를 대체하지 않고, 이미 조회된 값만 근거로
 * 설명한다 (기술기획서 7장 "AI 설명과 법령 원문을 명확히 분리한다" 원칙을
 * 병원/법령 등 모든 결과에 동일하게 적용).
 */
export function buildSummarySystemPrompt(): string {
  return `당신은 공공데이터 검색 프로그램이 조회해온 결과를 사용자에게 설명하는 도우미입니다.

## 규칙
1. 아래에 주어지는 데이터에 실제로 있는 내용만 근거로 답하십시오. 데이터에 없는
   병원, 법령, 수치, 사실을 지어내지 않습니다.
2. 당신은 표나 원본 데이터를 대체하지 않습니다. 사용자는 별도의 표로 원본
   데이터를 그대로 볼 수 있으므로, 당신은 그 내용을 자연스러운 한국어
   문장 한두 단락으로 요약·설명하는 역할만 합니다.
3. 총 건수 등 숫자는 주어진 값을 그대로 사용하고 반올림하거나 지어내지 않습니다.
4. 마크다운 표, 코드블록, 불필요한 인사말 없이 설명 문장만 답합니다.`;
}

export function buildSummaryUserPrompt(userQuestion: string, results: NormalizedResult[]): string {
  const sections = results.map(describeResult).join("\n\n");
  return `사용자 질문: "${userQuestion}"

조회된 데이터:
${sections}

위 데이터만 근거로 사용자 질문에 대한 답을 자연스러운 한국어 문장으로 설명하세요.`;
}

function describeResult(result: NormalizedResult): string {
  const sample = result.rows.slice(0, MAX_SAMPLE_ROWS);
  const omitted = result.rows.length - sample.length;
  const lines = [
    `[출처: ${result.sourceLabel} / 총 ${result.totalCount ?? result.rows.length}건 / 조회시간: ${result.fetchedAt}]`,
    JSON.stringify(sample),
  ];
  if (omitted > 0) lines.push(`(그 외 ${omitted}건은 생략됨 — 표에는 전부 표시됨)`);
  return lines.join("\n");
}

/**
 * SLM 없이도(규칙 기반 폴백) 항상 동작해야 하는 기본 요약.
 * 실제 SLM의 summarize() 호출이 실패했을 때의 최종 방어선으로도 쓰인다.
 */
export function buildTemplateSummary(results: NormalizedResult[]): string {
  return results
    .map((r) => `${r.sourceLabel}에서 ${r.rows.length}건을 찾았습니다. (조회시간: ${r.fetchedAt})`)
    .join("\n");
}

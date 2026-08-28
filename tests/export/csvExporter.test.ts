import { describe, expect, it } from "vitest";
import { toCsvString } from "../../core/export/csvExporter";

describe("toCsvString", () => {
  it("헤더와 행을 CSV로 직렬화한다", () => {
    const csv = toCsvString([
      { name: "가나병원", region: "서울" },
      { name: "다라병원", region: "부산" },
    ]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("name,region");
    expect(lines[1]).toBe("가나병원,서울");
    expect(lines[2]).toBe("다라병원,부산");
  });

  it("쉼표/줄바꿈이 포함된 값은 따옴표로 감싼다", () => {
    const csv = toCsvString([{ note: '값, "인용" 포함' }]);
    expect(csv).toContain('"값, ""인용"" 포함"');
  });

  it("빈 배열이면 BOM만 반환한다", () => {
    expect(toCsvString([])).toBe("﻿");
  });
});

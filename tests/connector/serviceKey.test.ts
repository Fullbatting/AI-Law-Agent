import { describe, expect, it } from "vitest";
import { normalizeServiceKey } from "../../connectors/common/serviceKey";

describe("normalizeServiceKey", () => {
  it("퍼센트 인코딩이 없는 키(Decoding)는 그대로 둔다", () => {
    expect(normalizeServiceKey("abcDEF123+xyz==")).toBe("abcDEF123+xyz==");
  });

  it("퍼센트 인코딩된 키(Encoding)는 디코딩해서 반환한다", () => {
    expect(normalizeServiceKey("abcDEF123%2Bxyz%3D%3D")).toBe("abcDEF123+xyz==");
  });

  it("앞뒤 공백은 제거한다", () => {
    expect(normalizeServiceKey("  abcDEF123  ")).toBe("abcDEF123");
  });

  it("디코딩에 실패하는 값은 원본을 그대로 반환한다", () => {
    expect(normalizeServiceKey("broken%")).toBe("broken%");
  });
});

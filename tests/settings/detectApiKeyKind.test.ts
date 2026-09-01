import { describe, expect, it } from "vitest";
import { detectApiKeyKind, extractOcFromValue } from "../../core/settings/detectApiKeyKind";

const SAMPLE_HIRA_KEY_DECODED =
  "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6aB==";
const SAMPLE_HIRA_KEY_ENCODED =
  "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6aB%3D%3D";

describe("detectApiKeyKind", () => {
  it("빈 값은 unknown이다", () => {
    expect(detectApiKeyKind("")).toBe("unknown");
    expect(detectApiKeyKind("   ")).toBe("unknown");
  });

  it("긴 base64 형태의 값은 HIRA 서비스키로 인식한다", () => {
    expect(detectApiKeyKind(SAMPLE_HIRA_KEY_DECODED)).toBe("hira");
    expect(detectApiKeyKind(SAMPLE_HIRA_KEY_ENCODED)).toBe("hira");
  });

  it("짧은 아이디 형태의 값은 법제처 OC로 인식한다", () => {
    expect(detectApiKeyKind("hongildong")).toBe("law");
    expect(detectApiKeyKind("my-id_123")).toBe("law");
  });

  it("이메일 전체를 붙여넣으면 법제처 OC로 인식한다", () => {
    expect(detectApiKeyKind("hongildong@example.com")).toBe("law");
  });

  it("애매한 값(중간 길이의 공백/특수문자 포함 문자열)은 unknown이다", () => {
    expect(detectApiKeyKind("this has spaces in it")).toBe("unknown");
  });

  it("25~39자 사이의 애매한 길이의 영숫자 값은 unknown이다", () => {
    expect(detectApiKeyKind("a".repeat(30))).toBe("unknown");
  });
});

describe("extractOcFromValue", () => {
  it("이메일이면 @ 앞부분만 반환한다", () => {
    expect(extractOcFromValue("hongildong@example.com")).toBe("hongildong");
  });

  it("이메일이 아니면 그대로 반환한다", () => {
    expect(extractOcFromValue("hongildong")).toBe("hongildong");
  });
});

/**
 * 사용자가 어떤 API 키인지 지정하지 않고 값만 붙여넣었을 때, 형식적 특징으로
 * HIRA 서비스키인지 법제처 OC인지 추정한다.
 *
 * 두 값 모두 그 자체에는 "이건 HIRA 키", "이건 법제처 OC" 같은 식별 정보가
 * 들어있지 않다 — 공공데이터포털/법제처 모두 순수한 문자열 크리덴셜만 발급한다.
 * 다만 실제 발급되는 값의 "생김새"가 뚜렷하게 다르므로 휴리스틱으로 상당히
 * 신뢰성 있게 구분할 수 있다:
 *
 * - HIRA 서비스키(공공데이터포털 발급)는 매우 길고(보통 80자 이상) base64/URL
 *   인코딩에 쓰이는 문자(A-Z, a-z, 0-9, +, /, =, %)로 이뤄진다.
 * - 법제처 OC는 신청 시 등록한 이메일의 아이디 부분으로, 사람이 고른 짧은
 *   문자열(영문/숫자/.-_)이라 20자를 넘는 경우가 드물다.
 *
 * 두 조건 중 어디에도 뚜렷하게 들어맞지 않으면 "unknown"을 반환해 호출자가
 * 사용자에게 직접 확인받도록 한다 — 애매할 때 잘못 추측해서 엉뚱한 자리에
 * 저장하는 것보다는 낫다.
 */
export type ApiKeyKind = "hira" | "law" | "unknown";

const HIRA_MIN_LENGTH = 40;
const HIRA_CHARSET = /^[A-Za-z0-9+/=%._-]+$/;
const OC_MAX_LENGTH = 24;
const OC_CHARSET = /^[A-Za-z0-9._-]+$/;

export function detectApiKeyKind(rawValue: string): ApiKeyKind {
  const value = rawValue.trim();
  if (!value) return "unknown";

  // 이메일 전체("hong@example.com")를 붙여넣은 경우 — 법제처 OC는 로컬파트만 쓴다.
  if (value.includes("@")) return "law";

  if (value.length >= HIRA_MIN_LENGTH && HIRA_CHARSET.test(value)) return "hira";
  if (value.length <= OC_MAX_LENGTH && OC_CHARSET.test(value)) return "law";
  return "unknown";
}

/** 이메일 전체를 붙여넣었을 때 법제처 OC로 쓸 로컬파트만 추출한다. */
export function extractOcFromValue(rawValue: string): string {
  const value = rawValue.trim();
  const at = value.indexOf("@");
  return at === -1 ? value : value.slice(0, at);
}

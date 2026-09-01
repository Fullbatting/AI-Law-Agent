/**
 * 공공데이터포털은 서비스키를 "일반 인증키(Encoding)"과 "(Decoding)" 두 가지
 * 형태로 함께 보여준다. 화면에 먼저 나오는 Encoding 값을 그대로 복사해
 * 붙여넣는 사용자가 많은데, 그 값은 이미 URL 인코딩되어 있어(`+`→`%2B` 등)
 * `URLSearchParams.set()`으로 다시 인코딩하면 `%2B`가 `%252B`로 이중 인코딩
 * 되어 서버가 등록되지 않은 키로 인식하고 `HTTP 403 Forbidden`을 반환한다.
 *
 * 이미 퍼센트 인코딩된 형태(`%XX`)로 보이면 한 번 디코딩해서, Encoding/Decoding
 * 어느 쪽을 붙여넣어도 항상 원본(Decoding) 값으로 정규화한다.
 */
export function normalizeServiceKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!/%[0-9A-Fa-f]{2}/.test(key)) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    // 디코딩에 실패하면(예: 원래부터 '%'를 포함한 값) 원본을 그대로 쓴다.
    return key;
  }
}

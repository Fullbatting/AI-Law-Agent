import { XMLParser } from "fast-xml-parser";

/**
 * 공공데이터 API는 기관에 따라 XML 또는 JSON을 반환한다.
 * 응답 텍스트를 보고 적절한 파서로 객체로 변환한다.
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export function parseApiResponse(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("<")) {
    return xmlParser.parse(trimmed);
  }
  return JSON.parse(trimmed);
}

/** 공공데이터포털류 API가 흔히 쓰는 결과코드 필드에서 오류 여부를 판단한다 */
export function isPublicDataApiError(parsed: unknown): { isError: boolean; message?: string } {
  const obj = parsed as Record<string, unknown>;
  // OpenAPI_ServiceResponse (XML 오류 포맷)
  const serviceResponse = obj?.["OpenAPI_ServiceResponse"] as
    | Record<string, unknown>
    | undefined;
  if (serviceResponse) {
    const header = (serviceResponse["cmmMsgHeader"] as Record<string, unknown>) ?? {};
    return {
      isError: true,
      message: String(header["returnAuthMsg"] ?? header["errMsg"] ?? "공공데이터 API 오류"),
    };
  }
  return { isError: false };
}

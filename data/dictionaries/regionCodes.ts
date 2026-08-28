/**
 * HIRA 병원정보서비스가 사용하는 시도코드(sidoCd).
 * 사용자가 "서울", "부산" 처럼 자연어로 말한 지역명을 API 파라미터로 바꾸는 데 사용한다.
 */
export const REGION_NAME_TO_SIDO_CODE: Record<string, string> = {
  서울: "110000",
  부산: "210000",
  대구: "220000",
  인천: "230000",
  광주: "240000",
  대전: "250000",
  울산: "260000",
  세종: "290000",
  경기: "310000",
  강원: "320000",
  충북: "330000",
  충남: "340000",
  전북: "350000",
  전남: "360000",
  경북: "370000",
  경남: "380000",
  제주: "390000",
};

export function regionNameToSidoCode(name: string): string | undefined {
  const normalized = name.trim().replace(/(특별시|광역시|특별자치시|특별자치도|도)$/u, "");
  return REGION_NAME_TO_SIDO_CODE[normalized];
}

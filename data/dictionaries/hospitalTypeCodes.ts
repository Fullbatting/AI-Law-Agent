/**
 * HIRA 병원정보서비스가 사용하는 종별코드(clCd).
 */
export const HOSPITAL_TYPE_NAME_TO_CODE: Record<string, string> = {
  상급종합병원: "01",
  종합병원: "11",
  병원: "21",
  요양병원: "28",
  정신병원: "29",
  의원: "31",
  치과병원: "41",
  치과의원: "51",
  조산원: "61",
  보건소: "71",
  보건지소: "72",
  보건진료소: "75",
};

export function hospitalTypeNameToCode(name: string): string | undefined {
  return HOSPITAL_TYPE_NAME_TO_CODE[name.trim()];
}

export function hospitalTypeCodeToName(code: string): string | undefined {
  const entry = Object.entries(HOSPITAL_TYPE_NAME_TO_CODE).find(([, v]) => v === code);
  return entry?.[0];
}

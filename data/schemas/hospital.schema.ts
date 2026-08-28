import { z } from "zod";

/** HIRA 병원정보서비스 getHospBasisList 항목(item)의 원본 필드 스키마 (필요한 필드만 검증) */
export const hiraHospitalItemSchema = z.object({
  ykiho: z.string().optional(), // 요양기관기호
  yadmNm: z.string().optional(), // 요양기관명
  clCd: z.string().optional(), // 종별코드
  clCdNm: z.string().optional(), // 종별코드명
  sidoCd: z.string().optional(),
  sidoCdNm: z.string().optional(),
  sgguCd: z.string().optional(),
  sgguCdNm: z.string().optional(),
  addr: z.string().optional(), // 주소
  telno: z.string().optional(), // 전화번호
  hospUrl: z.string().optional(),
  estbDd: z.string().optional(), // 개설일자
  drTotCnt: z.union([z.string(), z.number()]).optional(), // 의사총수
  emyDayYn: z.union([z.string(), z.number()]).optional(), // 응급실 운영 여부(일부 API에서 제공)
});

export type HiraHospitalItem = z.infer<typeof hiraHospitalItemSchema>;

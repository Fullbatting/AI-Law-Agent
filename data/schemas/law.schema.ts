import { z } from "zod";

/** 법제처 국가법령정보 OPEN API 법령 검색(target=law) 항목의 원본 필드 스키마 */
export const lawSearchItemSchema = z.object({
  법령일련번호: z.union([z.string(), z.number()]).optional(),
  법령명한글: z.string().optional(),
  법령구분명: z.string().optional(),
  소관부처명: z.string().optional(),
  공포일자: z.union([z.string(), z.number()]).optional(),
  공포번호: z.union([z.string(), z.number()]).optional(),
  시행일자: z.union([z.string(), z.number()]).optional(),
  법령상세링크: z.string().optional(),
});

export type LawSearchItem = z.infer<typeof lawSearchItemSchema>;

/** 내부 표준 법령 레코드 */
export const normalizedLawSchema = z.object({
  law_id: z.string().nullable(),
  name: z.string(),
  law_type: z.string().nullable(),
  ministry: z.string().nullable(),
  promulgation_date: z.string().nullable(),
  effective_date: z.string().nullable(),
  detail_url: z.string().nullable(),
});

export type NormalizedLaw = z.infer<typeof normalizedLawSchema>;

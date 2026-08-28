import { z } from "zod";

/**
 * QueryDSL의 Zod 스키마.
 *
 * SLM 출력은 신뢰하지 않고 반드시 이 스키마로 검증한 뒤에만 Tool Router로
 * 넘긴다 (기술기획서 5장, 25장 "SLM이 잘못된 Query 생성" 리스크 대응).
 */

export const filterOperatorSchema = z.enum([
  "eq",
  "ne",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
]);

export const queryFilterSchema = z.object({
  field: z.string().min(1),
  operator: filterOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
});

export const querySortSchema = z
  .object({
    field: z.string().min(1),
    order: z.enum(["asc", "desc"]),
  })
  .nullable();

export const queryAggregateSchema = z.object({
  fn: z.enum(["count", "sum", "avg", "min", "max"]),
  field: z.string().optional(),
  as: z.string().optional(),
});

export const queryOperationSchema = z.enum([
  "search",
  "get",
  "filter",
  "sort",
  "group",
  "aggregate",
  "join",
  "compare",
  "export",
]);

// join은 QueryDSL을 재귀적으로 참조하므로 z.lazy 사용
export const queryDslSchema: z.ZodType<import("../../query/dsl/types").QueryDSL> = z.lazy(() =>
  z.object({
    source: z.string().min(1),
    operation: queryOperationSchema,
    entity: z.string().min(1),
    filters: z.array(queryFilterSchema).optional(),
    select: z.array(z.string()).optional(),
    sort: querySortSchema.optional(),
    group_by: z.array(z.string()).optional(),
    aggregate: z.array(queryAggregateSchema).optional(),
    join: z
      .object({
        with: queryDslSchema,
        on: z.string().min(1),
      })
      .optional(),
    limit: z.number().int().positive().max(1000).optional(),
    export_format: z.enum(["excel", "csv", "json"]).optional(),
  })
);

export const queryPlanSchema = z.object({
  intent: z.string(),
  queries: z.array(queryDslSchema).min(1),
});

export type QueryDslParsed = z.infer<typeof queryDslSchema>;
export type QueryPlanParsed = z.infer<typeof queryPlanSchema>;

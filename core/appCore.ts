import type { AppDatabase } from "./db/schema";
import { ToolRegistry } from "./tools/registry";
import { ToolRouter } from "./tools/router";
import { PermissionManager } from "./permission/permissionManager";
import { QueryPlanner } from "./planner/queryPlanner";
import { CacheManager } from "./cache/cacheManager";
import { ConversationManager } from "./conversation/conversationManager";
import type { SlmRuntime } from "./llm/inference/types";
import type { ModelManager } from "./llm/modelManager";
import type { NormalizedResult } from "./types/domain";
import type { QueryDSL } from "./query/dsl/types";

export interface AskResult {
  ok: boolean;
  /** 사용자에게 그대로 보여줄 안내/오류 메시지 (성공 시에는 결과 요약) */
  message: string;
  results: NormalizedResult[];
  error?: string;
}

/**
 * Application Core — 기술기획서 3장 다이어그램의
 * "Conversation Manager / Query Planner / Tool Router / Cache Manager /
 * Permission Manager"를 하나로 엮는 최상위 오케스트레이터.
 *
 * Electron main process(IPC 핸들러)가 이 클래스 하나만 알면 되도록 만든다.
 */
export class AppCore {
  readonly registry: ToolRegistry;
  readonly router: ToolRouter;
  readonly planner: QueryPlanner;
  readonly cache: CacheManager;
  readonly conversations: ConversationManager;
  readonly modelManager: ModelManager;

  /**
   * @param fallbackRuntime 사용자가 GGUF 모델을 업로드하지 않았을 때(또는 로드에
   * 실패했을 때) 사용할 런타임. llama.cpp 서버가 떠 있으면 그것을, 아니면
   * 규칙 기반 폴백을 넘긴다 (core/llm/inference/index.ts의 createSlmRuntime 참고).
   */
  constructor(db: AppDatabase, modelManager: ModelManager, fallbackRuntime: SlmRuntime) {
    this.registry = new ToolRegistry();
    const permissions = new PermissionManager(this.registry);
    this.router = new ToolRouter(this.registry, permissions);
    this.modelManager = modelManager;
    // GGUF 모델이 로드되어 있으면 그걸 우선 쓰고, 없으면 폴백으로 넘어간다.
    // 사용자가 대화 도중 모델을 로드/해제해도 다음 질의부터 바로 반영된다.
    this.planner = new QueryPlanner(
      () => this.modelManager.getRuntime() ?? fallbackRuntime,
      this.registry
    );
    this.cache = new CacheManager(db);
    this.conversations = new ConversationManager(db);
  }

  /**
   * 사용자의 자연어 질문 하나를 끝까지 처리한다:
   * 대화 저장 → QueryPlan 생성 → 캐시 확인 → Tool 실행 → 결과 저장.
   */
  async ask(conversationId: number, userText: string): Promise<AskResult> {
    const userMessage = this.conversations.addMessage(conversationId, "user", userText);

    const planning = await this.planner.plan(userText);
    if (!planning.ok || !planning.plan) {
      const message = planning.error ?? "질문을 이해하지 못했습니다.";
      this.conversations.addMessage(conversationId, "assistant", message);
      return { ok: false, message, results: [], error: planning.error };
    }

    const results: NormalizedResult[] = [];
    for (const dsl of planning.plan.queries) {
      const result = await this.runWithCache(dsl);
      if (!result.ok) {
        const message = `데이터를 가져오지 못했습니다: ${result.error}`;
        this.conversations.addMessage(conversationId, "assistant", message);
        return { ok: false, message, results, error: result.error };
      }
      results.push(result.result);
      this.conversations.recordApiCall(userMessage.id, dsl, result.result);
    }

    const summary = summarizeResults(results);
    this.conversations.addMessage(conversationId, "assistant", summary);
    return { ok: true, message: summary, results };
  }

  private async runWithCache(
    dsl: QueryDSL
  ): Promise<{ ok: true; result: NormalizedResult } | { ok: false; error: string }> {
    const cached = this.cache.get(dsl);
    if (cached) return { ok: true, result: cached };

    const execution = await this.router.execute(dsl);
    if (!execution.ok || !execution.result) {
      return { ok: false, error: execution.error ?? "알 수 없는 오류" };
    }
    this.cache.set(dsl, execution.result);
    return { ok: true, result: execution.result };
  }
}

function summarizeResults(results: NormalizedResult[]): string {
  return results
    .map((r) => `${r.sourceLabel}에서 ${r.rows.length}건을 찾았습니다. (조회시간: ${r.fetchedAt})`)
    .join("\n");
}

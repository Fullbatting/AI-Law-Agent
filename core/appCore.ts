import type { AppDatabase } from "./db/schema";
import { ToolRegistry, defaultConnectors } from "./tools/registry";
import { ToolRouter } from "./tools/router";
import { PermissionManager } from "./permission/permissionManager";
import { QueryPlanner } from "./planner/queryPlanner";
import { CacheManager } from "./cache/cacheManager";
import { ConversationManager } from "./conversation/conversationManager";
import type { SlmRuntime } from "./llm/inference/types";
import type { ModelManager } from "./llm/modelManager";
import { SettingsManager } from "./settings/settingsManager";
import { CustomApiConnector } from "../connectors/generic/customApiConnector";
import type { NormalizedResult } from "./types/domain";
import type { QueryDSL } from "./query/dsl/types";
import { buildTemplateSummary } from "./llm/prompt/summarizePrompt";

const CUSTOM_SOURCE_PREFIX = "custom:";

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
  readonly settingsManager: SettingsManager;
  private readonly slmProvider: () => SlmRuntime;

  /**
   * @param fallbackRuntime 사용자가 GGUF 모델을 업로드하지 않았을 때(또는 로드에
   * 실패했을 때) 사용할 런타임. llama.cpp 서버가 떠 있으면 그것을, 아니면
   * 규칙 기반 폴백을 넘긴다 (core/llm/inference/index.ts의 createSlmRuntime 참고).
   * @param settingsManager 설정 화면에서 입력한 HIRA/법제처 API 키를 저장·조회한다.
   * Connector들은 이 값을 매 호출 시점에 다시 읽으므로, 사용자가 설정을
   * 바꾸면 앱을 재시작하지 않아도 다음 질의부터 바로 반영된다.
   */
  constructor(
    db: AppDatabase,
    modelManager: ModelManager,
    fallbackRuntime: SlmRuntime,
    settingsManager: SettingsManager
  ) {
    this.settingsManager = settingsManager;
    this.registry = new ToolRegistry(defaultConnectors(settingsManager));
    this.refreshCustomApis();
    const permissions = new PermissionManager(this.registry);
    this.router = new ToolRouter(this.registry, permissions);
    this.modelManager = modelManager;
    // GGUF 모델이 로드되어 있으면 그걸 우선 쓰고, 없으면 폴백으로 넘어간다.
    // 사용자가 대화 도중 모델을 로드/해제해도 다음 질의부터 바로 반영된다.
    this.slmProvider = () => this.modelManager.getRuntime() ?? fallbackRuntime;
    this.planner = new QueryPlanner(this.slmProvider, this.registry);
    this.cache = new CacheManager(db);
    this.conversations = new ConversationManager(db);
  }

  /**
   * 설정 화면에서 등록/수정/삭제한 커스텀 API 목록을 registry에 다시
   * 반영한다. "custom:" 접두사가 붙은 Connector를 전부 지우고 최신
   * SettingsManager.getCustomApis()로 새로 등록하는 방식이라, 앱을
   * 재시작하지 않아도 다음 질문부터 바로 반영된다. 커스텀 API를
   * 추가/수정/삭제하는 IPC 핸들러가 설정을 바꾼 직후 이 메서드를 호출한다.
   */
  refreshCustomApis(): void {
    this.registry.removeBySourcePrefix(CUSTOM_SOURCE_PREFIX);
    for (const config of this.settingsManager.getCustomApis()) {
      this.registry.register(new CustomApiConnector(config));
    }
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

    const summary = await this.summarize(userText, results);
    this.conversations.addMessage(conversationId, "assistant", summary);
    return { ok: true, message: summary, results };
  }

  /**
   * 조회된 결과를 자연어로 설명한다. SLM이 있으면 그걸로 매끄럽게 풀어서
   * 설명하고, 없거나(규칙 기반 폴백) 호출이 실패하면 고정 템플릿으로
   * 대체한다 — 어느 쪽이든 원본 표(results)는 항상 그대로 함께 반환되므로
   * 설명 문장이 부정확해도 사용자가 원본과 대조할 수 있다.
   */
  private async summarize(userText: string, results: NormalizedResult[]): Promise<string> {
    try {
      return await this.slmProvider().summarize({ userQuestion: userText, results });
    } catch {
      return buildTemplateSummary(results);
    }
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

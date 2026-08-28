import type { SlmRuntime, SlmCompletionRequest, SlmSummarizeRequest } from "./types";
import { buildSummarySystemPrompt, buildSummaryUserPrompt } from "../prompt/summarizePrompt";

/**
 * 사용자가 업로드/선택한 GGUF 모델 파일을 node-llama-cpp로 직접 프로세스 내에서
 * 구동하는 런타임. 별도의 llama.cpp 서버 프로세스를 띄우지 않고 Electron
 * 메인 프로세스 안에서 바로 추론한다.
 *
 * node-llama-cpp는 ESM 전용 패키지라 (이 프로젝트는 CommonJS) 정적 import를
 * 쓸 수 없다. 매 호출마다 동적 import를 쓰지만, Node는 같은 모듈을 다시
 * import해도 캐시된 인스턴스를 재사용하므로 실질적인 비용은 거의 없다.
 *
 * 대화 세션은 질의마다 새로 만들고 끝나면 즉시 dispose한다 — Query Planner의
 * 각 요청은 서로 독립적인 단발성 완성(completion)이어야 하며, 이전 대화가
 * 이번 QueryDSL 생성에 영향을 주면 안 되기 때문이다 (LlamaCppRuntime,
 * RuleBasedFallbackRuntime과 동일한 무상태 계약을 유지한다).
 */
export class NodeLlamaCppRuntime implements SlmRuntime {
  readonly name = "node-llama-cpp";

  constructor(
    /** node-llama-cpp의 LlamaContext 인스턴스. 타입 의존을 피하려고 unknown으로 받는다. */
    private readonly context: unknown
  ) {}

  async complete(request: SlmCompletionRequest): Promise<string> {
    const promptText = request.correctionHint
      ? `${request.prompt}\n\n[이전 출력이 아래 오류로 거부되었습니다. 다시 올바른 JSON으로만 답하세요]\n${request.correctionHint}`
      : request.prompt;
    return this.runSession(request.system, promptText, request.maxTokens ?? 512);
  }

  async summarize(request: SlmSummarizeRequest): Promise<string> {
    const system = buildSummarySystemPrompt();
    const userPrompt = buildSummaryUserPrompt(request.userQuestion, request.results);
    return this.runSession(system, userPrompt, request.maxTokens ?? 300);
  }

  private async runSession(system: string, userPrompt: string, maxTokens: number): Promise<string> {
    const { LlamaChatSession } = (await import("node-llama-cpp")) as typeof import("node-llama-cpp");
    const context = this.context as import("node-llama-cpp").LlamaContext;

    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: system,
    });

    try {
      return await session.prompt(userPrompt, { maxTokens, temperature: 0.1 });
    } finally {
      await session.dispose({ disposeSequence: true });
    }
  }
}

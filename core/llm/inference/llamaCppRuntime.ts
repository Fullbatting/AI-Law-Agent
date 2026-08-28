import type { SlmRuntime, SlmCompletionRequest } from "./types";

/**
 * llama.cpp를 `llama-server` 모드(OpenAI 호환 /v1/chat/completions 엔드포인트)로
 * 띄워둔 뒤 HTTP로 호출하는 런타임.
 *
 * 예: llama-server -m model.gguf --port 8080
 *
 * node-llama-cpp 같은 네이티브 바인딩 대신 HTTP 서버 모드를 택한 이유는
 * Electron 배포 시 네이티브 애드온 재빌드 부담 없이 llama.cpp 바이너리만
 * 교체하면 되기 때문이다.
 */
export class LlamaCppRuntime implements SlmRuntime {
  readonly name = "llama.cpp";

  constructor(
    private readonly baseUrl: string = process.env.LLAMA_SERVER_URL ?? "http://127.0.0.1:8080",
    private readonly timeoutMs: number = 30_000
  ) {}

  async complete(request: SlmCompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            { role: "system", content: request.system },
            {
              role: "user",
              content: request.correctionHint
                ? `${request.prompt}\n\n[이전 출력이 아래 오류로 거부되었습니다. 다시 올바른 JSON으로만 답하세요]\n${request.correctionHint}`
                : request.prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: request.maxTokens ?? 512,
        }),
      });
      if (!res.ok) {
        throw new Error(`llama.cpp 서버 오류: HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timer);
    }
  }
}

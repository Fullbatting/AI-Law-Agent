import { describe, expect, it, vi, beforeEach } from "vitest";
import { NodeLlamaCppRuntime } from "../../core/llm/inference/nodeLlamaCppRuntime";

const promptMock = vi.fn(async (text: string) => `echo: ${text}`);
const disposeMock = vi.fn(async () => {});

class FakeLlamaChatSession {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
  prompt = promptMock;
  dispose = disposeMock;
}

vi.mock("node-llama-cpp", () => ({
  LlamaChatSession: FakeLlamaChatSession,
}));

beforeEach(() => {
  promptMock.mockClear();
  disposeMock.mockClear();
});

describe("NodeLlamaCppRuntime", () => {
  const mockSequence = { id: "seq" };
  const mockContext = { getSequence: vi.fn(() => mockSequence) };

  it("질의마다 새 세션을 만들고 끝나면 dispose한다", async () => {
    const runtime = new NodeLlamaCppRuntime(mockContext);
    const result = await runtime.complete({
      system: "시스템 프롬프트",
      prompt: "사용자 질문",
      userText: "사용자 질문",
    });

    expect(result).toBe("echo: 사용자 질문");
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(disposeMock).toHaveBeenCalledWith({ disposeSequence: true });
  });

  it("correctionHint가 있으면 프롬프트에 덧붙인다", async () => {
    const runtime = new NodeLlamaCppRuntime(mockContext);
    await runtime.complete({
      system: "시스템",
      prompt: "질문",
      userText: "질문",
      correctionHint: "field 오류",
    });

    const [sentPrompt] = promptMock.mock.calls[0] as [string];
    expect(sentPrompt).toContain("질문");
    expect(sentPrompt).toContain("field 오류");
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";
import { LlamaCppRuntime } from "../../core/llm/inference/llamaCppRuntime";
import type { NormalizedResult } from "../../core/types/domain";

function mockFetchOnce(content: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LlamaCppRuntime", () => {
  it("complete()는 system/prompt를 chat completion 요청으로 보낸다", async () => {
    const fetchMock = mockFetchOnce('{"intent":"hospital_search","queries":[]}');
    const runtime = new LlamaCppRuntime("http://fake-llama:1234");

    const result = await runtime.complete({
      system: "시스템 프롬프트",
      prompt: "사용자 프롬프트",
      userText: "질문",
    });

    expect(result).toBe('{"intent":"hospital_search","queries":[]}');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://fake-llama:1234/v1/chat/completions");
    const body = JSON.parse(options.body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "시스템 프롬프트" },
      { role: "user", content: "사용자 프롬프트" },
    ]);
  });

  it("summarize()는 결과 데이터를 근거로 자연어 설명을 요청한다", async () => {
    const fetchMock = mockFetchOnce("서울에 종합병원이 1곳 있습니다.");
    const runtime = new LlamaCppRuntime("http://fake-llama:1234");

    const results: NormalizedResult[] = [
      {
        entity: "hospital",
        source: "hira",
        sourceLabel: "건강보험심사평가원(HIRA)",
        fetchedAt: "2026-08-28T00:00:00.000Z",
        rows: [{ name: "가나병원", region: "서울" }],
        totalCount: 1,
      },
    ];

    const result = await runtime.summarize({ userQuestion: "서울 병원 알려줘", results });

    expect(result).toBe("서울에 종합병원이 1곳 있습니다.");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("서울 병원 알려줘");
    expect(userMessage.content).toContain("가나병원");
  });
});

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppCore } from "../core/appCore";
import { ModelManager } from "../core/llm/modelManager";
import { SettingsManager } from "../core/settings/settingsManager";
import { RuleBasedFallbackRuntime } from "../core/llm/inference/ruleBasedFallback";
import { openInMemoryDatabase } from "../core/db/schema";
import type { SlmSummarizeRequest } from "../core/llm/inference/types";

const SAMPLE_HIRA_RESPONSE = {
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: {
      items: {
        item: [
          {
            yadmNm: "가나종합병원",
            clCdNm: "종합병원",
            sidoCdNm: "서울",
            sgguCdNm: "강남구",
          },
        ],
      },
      totalCount: 1,
    },
  },
};

/** RuleBasedFallbackRuntime과 동일하게 QueryDSL은 만들지만 summarize()만 다르게 동작하는 테스트용 런타임 */
class ThrowingSummarizeRuntime extends RuleBasedFallbackRuntime {
  async summarize(): Promise<string> {
    throw new Error("summarize 호출 실패 (테스트)");
  }
}

class SmartSummarizeRuntime extends RuleBasedFallbackRuntime {
  async summarize(request: SlmSummarizeRequest): Promise<string> {
    return `AI 요약: 총 ${request.results[0]?.rows.length ?? 0}건을 찾았어요.`;
  }
}

let settingsPath: string;
let appSettingsPath: string;

beforeEach(() => {
  process.env.HIRA_SERVICE_KEY = "TEST_KEY";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appcore-test-"));
  settingsPath = path.join(tmpDir, "model-settings.json");
  appSettingsPath = path.join(tmpDir, "app-settings.json");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(SAMPLE_HIRA_RESPONSE),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HIRA_SERVICE_KEY;
});

describe("AppCore.ask", () => {
  it("규칙 기반 폴백은 고정 템플릿으로 결과를 요약한다", async () => {
    const core = new AppCore(await openInMemoryDatabase(), new ModelManager(settingsPath), new RuleBasedFallbackRuntime(), new SettingsManager(appSettingsPath));
    const conversation = core.conversations.createConversation();

    const result = await core.ask(conversation.id, "서울 종합병원 목록을 보여줘");

    expect(result.ok).toBe(true);
    expect(result.message).toBe("건강보험심사평가원(HIRA)에서 1건을 찾았습니다. (조회시간: " + result.results[0].fetchedAt + ")");
    expect(result.results).toHaveLength(1);
  });

  it("SLM의 summarize() 출력이 실제 사용자 메시지로 쓰인다", async () => {
    const core = new AppCore(await openInMemoryDatabase(), new ModelManager(settingsPath), new SmartSummarizeRuntime(), new SettingsManager(appSettingsPath));
    const conversation = core.conversations.createConversation();

    const result = await core.ask(conversation.id, "서울 종합병원 목록을 보여줘");

    expect(result.ok).toBe(true);
    expect(result.message).toBe("AI 요약: 총 1건을 찾았어요.");
  });

  it("summarize()가 실패해도 템플릿 요약으로 안전하게 대체되고 요청은 실패 처리되지 않는다", async () => {
    const core = new AppCore(await openInMemoryDatabase(), new ModelManager(settingsPath), new ThrowingSummarizeRuntime(), new SettingsManager(appSettingsPath));
    const conversation = core.conversations.createConversation();

    const result = await core.ask(conversation.id, "서울 종합병원 목록을 보여줘");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("건강보험심사평가원(HIRA)에서 1건을 찾았습니다");
  });

  it("어떤 요약이든 원본 결과(results)는 그대로 함께 반환된다", async () => {
    const core = new AppCore(await openInMemoryDatabase(), new ModelManager(settingsPath), new SmartSummarizeRuntime(), new SettingsManager(appSettingsPath));
    const conversation = core.conversations.createConversation();

    const result = await core.ask(conversation.id, "서울 종합병원 목록을 보여줘");

    expect(result.results[0].rows[0]).toMatchObject({ name: "가나종합병원" });
  });
});

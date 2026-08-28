import type { SlmRuntime } from "./types";
import { LlamaCppRuntime } from "./llamaCppRuntime";
import { RuleBasedFallbackRuntime } from "./ruleBasedFallback";

export type { SlmRuntime, SlmCompletionRequest } from "./types";
export { LlamaCppRuntime } from "./llamaCppRuntime";
export { RuleBasedFallbackRuntime } from "./ruleBasedFallback";

/**
 * 실행 환경에 llama.cpp 서버가 떠 있으면 그것을 사용하고,
 * 없으면(로컬 모델 미설치 등) 규칙 기반 폴백으로 자동 전환한다.
 * 기술기획서 17.1절의 "파인튜닝 이전, 프롬프트 기반 검증" 단계를 개발 환경에서
 * 실제 모델 없이도 그대로 재현하기 위한 장치다.
 */
export async function createSlmRuntime(baseUrl?: string): Promise<SlmRuntime> {
  const llama = new LlamaCppRuntime(baseUrl);
  if (await isReachable(baseUrl ?? process.env.LLAMA_SERVER_URL ?? "http://127.0.0.1:8080")) {
    return llama;
  }
  return new RuleBasedFallbackRuntime();
}

async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timer);
    return !!res && res.ok;
  } catch {
    return false;
  }
}

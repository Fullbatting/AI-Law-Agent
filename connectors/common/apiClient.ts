import type { ApiClientOptions } from "./types";

/**
 * 공용 HTTP 클라이언트.
 * - 모든 외부 API 호출은 이 클라이언트를 거친다 (fetch/undici 기반).
 * - Timeout, 재시도(retry)를 공통으로 처리한다 (기술기획서 25장 "API 장애" 대응).
 */
export class ApiClient {
  constructor(private readonly defaults: ApiClientOptions = {}) {}

  async get(url: string, options: ApiClientOptions = {}): Promise<string> {
    const timeoutMs = options.timeoutMs ?? this.defaults.timeoutMs ?? 10_000;
    const retries = options.retries ?? this.defaults.retries ?? 2;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
          throw new ApiRequestError(`HTTP ${res.status} ${res.statusText}`, res.status, url);
        }
        return await res.text();
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        // 마지막 시도가 아니면 짧게 대기 후 재시도 (지수 백오프)
        if (attempt < retries) {
          await sleep(300 * 2 ** attempt);
          continue;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`API 호출 실패: ${url}`);
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

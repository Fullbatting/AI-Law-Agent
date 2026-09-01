import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * 사용자가 설정 화면에서 등록한 임의의(범용) 공공/외부 API 하나에 대한 정의.
 * HIRA/법제처처럼 필드 매핑 코드를 따로 짜지 않고도, 이 정보만으로
 * CustomApiConnector(connectors/generic/customApiConnector.ts)가 호출 방법을
 * 조립한다 — 대신 구조화된 필드 매핑은 지원하지 않고 "검색어 하나"만 지원하는
 * 수준의 범용성이다 (core/settings/detectApiKeyKind.ts 및 README 참고).
 */
export interface CustomApiConfig {
  id: string;
  /** 서비스 이름. 화면 표시뿐 아니라 자연어 질문에서 이 API를 지목할 때도 쓰인다. */
  name: string;
  /** 요청을 보낼 기본 엔드포인트 URL */
  baseUrl: string;
  /** 이 키를 어디서 발급받았는지(참고용). 요청에는 쓰이지 않는다. */
  docsUrl?: string;
  /** 이 API가 무엇을 조회하는지 설명. 자연어 질문을 어느 API로 보낼지
   *  자동으로 판단할 때 이름과 함께 근거로 쓰인다. */
  description?: string;
  authType: "query" | "header" | "bearer" | "none";
  /** authType이 query/header일 때 파라미터/헤더 이름 (예: serviceKey, X-API-Key) */
  authKeyName?: string;
  authValue?: string;
  /** 사용자의 검색어를 실어 보낼 쿼리 파라미터 이름. 비워두면 검색어 없이 고정 파라미터로만 호출한다. */
  searchParamName?: string;
  /** 항상 붙일 고정 쿼리 파라미터. "key=value&key2=value2" 형식 */
  extraQueryParams?: string;
}

export interface AppSettings {
  hiraServiceKey?: string;
  lawApiOc?: string;
  customApis?: CustomApiConfig[];
}

/**
 * 사용자가 앱 UI(설정 화면)에서 입력한 API 키를 로컬 파일에 저장·관리한다.
 *
 * 지금까지는 HIRA_SERVICE_KEY/LAW_API_OC를 .env 파일을 직접 열어 편집해야만
 * 설정할 수 있었다 — 메모장으로 .env를 열어야 하는 건 비개발자 사용자에게는
 * 상당한 진입장벽이다. 이 매니저는 앱을 재시작하지 않고도 설정 화면에서
 * 바로 저장/반영되도록 하고, .env는 고급 사용자를 위한 대안으로 계속 지원한다
 * (설정 화면에서 입력한 값이 있으면 그걸 우선하고, 없으면 .env/환경변수로
 * 폴백한다).
 */
export class SettingsManager {
  private settings: AppSettings;

  constructor(private readonly settingsPath: string) {
    this.settings = this.readSettings();
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  getHiraServiceKey(): string {
    return this.settings.hiraServiceKey?.trim() || process.env.HIRA_SERVICE_KEY?.trim() || "";
  }

  getLawApiOc(): string {
    return this.settings.lawApiOc?.trim() || process.env.LAW_API_OC?.trim() || "";
  }

  update(patch: AppSettings): AppSettings {
    this.settings = { ...this.settings, ...patch };
    this.writeSettings();
    return this.get();
  }

  getCustomApis(): CustomApiConfig[] {
    return [...(this.settings.customApis ?? [])];
  }

  addCustomApi(config: Omit<CustomApiConfig, "id">): CustomApiConfig {
    const withId: CustomApiConfig = { ...config, id: crypto.randomUUID() };
    this.settings = { ...this.settings, customApis: [...this.getCustomApis(), withId] };
    this.writeSettings();
    return withId;
  }

  updateCustomApi(id: string, patch: Partial<Omit<CustomApiConfig, "id">>): CustomApiConfig | null {
    let updated: CustomApiConfig | null = null;
    const customApis = this.getCustomApis().map((api) => {
      if (api.id !== id) return api;
      updated = { ...api, ...patch, id };
      return updated;
    });
    if (!updated) return null;
    this.settings = { ...this.settings, customApis };
    this.writeSettings();
    return updated;
  }

  removeCustomApi(id: string): void {
    this.settings = { ...this.settings, customApis: this.getCustomApis().filter((api) => api.id !== id) };
    this.writeSettings();
  }

  private readSettings(): AppSettings {
    try {
      if (!fs.existsSync(this.settingsPath)) return {};
      return JSON.parse(fs.readFileSync(this.settingsPath, "utf8")) as AppSettings;
    } catch {
      return {};
    }
  }

  private writeSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), "utf8");
    } catch {
      /* 설정 저장 실패는 치명적이지 않으므로 무시한다 */
    }
  }
}

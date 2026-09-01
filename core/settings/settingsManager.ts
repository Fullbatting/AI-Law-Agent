import fs from "node:fs";
import path from "node:path";

export interface AppSettings {
  hiraServiceKey?: string;
  lawApiOc?: string;
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

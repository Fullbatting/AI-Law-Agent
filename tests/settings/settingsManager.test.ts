import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SettingsManager } from "../../core/settings/settingsManager";

let tmpDir: string;
let settingsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-manager-test-"));
  settingsPath = path.join(tmpDir, "app-settings.json");
  delete process.env.HIRA_SERVICE_KEY;
  delete process.env.LAW_API_OC;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.HIRA_SERVICE_KEY;
  delete process.env.LAW_API_OC;
});

describe("SettingsManager", () => {
  it("설정 파일이 없으면 빈 객체를 반환한다", () => {
    const manager = new SettingsManager(settingsPath);
    expect(manager.get()).toEqual({});
  });

  it("update()는 값을 병합하고 즉시 조회에 반영한다", () => {
    const manager = new SettingsManager(settingsPath);
    manager.update({ hiraServiceKey: "KEY_A" });
    expect(manager.get()).toEqual({ hiraServiceKey: "KEY_A" });

    manager.update({ lawApiOc: "test@example.com" });
    expect(manager.get()).toEqual({ hiraServiceKey: "KEY_A", lawApiOc: "test@example.com" });
  });

  it("update()는 파일에 영속화되어 새 인스턴스에서도 읽힌다", () => {
    const manager = new SettingsManager(settingsPath);
    manager.update({ hiraServiceKey: "KEY_A", lawApiOc: "test@example.com" });

    const reloaded = new SettingsManager(settingsPath);
    expect(reloaded.get()).toEqual({ hiraServiceKey: "KEY_A", lawApiOc: "test@example.com" });
  });

  it("저장된 값이 없으면 process.env 값으로 폴백한다", () => {
    process.env.HIRA_SERVICE_KEY = "ENV_KEY";
    process.env.LAW_API_OC = "env@example.com";
    const manager = new SettingsManager(settingsPath);

    expect(manager.getHiraServiceKey()).toBe("ENV_KEY");
    expect(manager.getLawApiOc()).toBe("env@example.com");
  });

  it("저장된 값이 있으면 process.env보다 우선한다", () => {
    process.env.HIRA_SERVICE_KEY = "ENV_KEY";
    const manager = new SettingsManager(settingsPath);
    manager.update({ hiraServiceKey: "SAVED_KEY" });

    expect(manager.getHiraServiceKey()).toBe("SAVED_KEY");
  });

  it("공백만 있는 값은 무시하고 폴백한다", () => {
    process.env.HIRA_SERVICE_KEY = "ENV_KEY";
    const manager = new SettingsManager(settingsPath);
    manager.update({ hiraServiceKey: "   " });

    expect(manager.getHiraServiceKey()).toBe("ENV_KEY");
  });

  it("깨진 설정 파일은 무시하고 빈 상태로 시작한다", () => {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, "{ not valid json", "utf8");

    const manager = new SettingsManager(settingsPath);
    expect(manager.get()).toEqual({});
  });
});

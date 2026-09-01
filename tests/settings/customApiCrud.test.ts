import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SettingsManager } from "../../core/settings/settingsManager";

let tmpDir: string;
let settingsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "custom-api-crud-test-"));
  settingsPath = path.join(tmpDir, "app-settings.json");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("SettingsManager 커스텀 API CRUD", () => {
  it("등록하지 않았으면 빈 배열을 반환한다", () => {
    const manager = new SettingsManager(settingsPath);
    expect(manager.getCustomApis()).toEqual([]);
  });

  it("addCustomApi는 id를 부여하고 목록에 추가한다", () => {
    const manager = new SettingsManager(settingsPath);
    const added = manager.addCustomApi({
      name: "기상청 단기예보",
      baseUrl: "https://apis.data.go.kr/weather",
      authType: "query",
      authKeyName: "serviceKey",
      authValue: "KEY",
    });

    expect(added.id).toBeTruthy();
    expect(manager.getCustomApis()).toHaveLength(1);
    expect(manager.getCustomApis()[0]).toMatchObject({ name: "기상청 단기예보" });
  });

  it("추가한 내용은 파일에 영속화되어 새 인스턴스에서도 읽힌다", () => {
    const manager = new SettingsManager(settingsPath);
    manager.addCustomApi({ name: "A API", baseUrl: "https://a.example.com", authType: "none" });

    const reloaded = new SettingsManager(settingsPath);
    expect(reloaded.getCustomApis()).toHaveLength(1);
    expect(reloaded.getCustomApis()[0].name).toBe("A API");
  });

  it("updateCustomApi는 지정한 필드만 바꾸고 나머지는 유지한다", () => {
    const manager = new SettingsManager(settingsPath);
    const added = manager.addCustomApi({
      name: "A API",
      baseUrl: "https://a.example.com",
      authType: "none",
    });

    const updated = manager.updateCustomApi(added.id, { name: "A API v2" });

    expect(updated?.name).toBe("A API v2");
    expect(updated?.baseUrl).toBe("https://a.example.com");
    expect(manager.getCustomApis()).toHaveLength(1);
  });

  it("updateCustomApi는 존재하지 않는 id면 null을 반환하고 목록을 바꾸지 않는다", () => {
    const manager = new SettingsManager(settingsPath);
    manager.addCustomApi({ name: "A API", baseUrl: "https://a.example.com", authType: "none" });

    const result = manager.updateCustomApi("no-such-id", { name: "X" });

    expect(result).toBeNull();
    expect(manager.getCustomApis()).toHaveLength(1);
    expect(manager.getCustomApis()[0].name).toBe("A API");
  });

  it("removeCustomApi는 해당 항목만 제거한다", () => {
    const manager = new SettingsManager(settingsPath);
    const a = manager.addCustomApi({ name: "A", baseUrl: "https://a.example.com", authType: "none" });
    const b = manager.addCustomApi({ name: "B", baseUrl: "https://b.example.com", authType: "none" });

    manager.removeCustomApi(a.id);

    const remaining = manager.getCustomApis();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  it("get()은 커스텀 API가 없으면 customApis 필드를 만들어내지 않는다", () => {
    const manager = new SettingsManager(settingsPath);
    manager.update({ hiraServiceKey: "K" });
    expect(manager.get()).toEqual({ hiraServiceKey: "K" });
  });
});

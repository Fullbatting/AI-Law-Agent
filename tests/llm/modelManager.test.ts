import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ModelManager } from "../../core/llm/modelManager";

const mockSequence = { id: "seq" };
const mockContext = {
  getSequence: vi.fn(() => mockSequence),
  dispose: vi.fn(async () => {}),
};
const mockModel = {
  createContext: vi.fn(async () => mockContext),
  dispose: vi.fn(async () => {}),
};
const loadModelMock = vi.fn(async (options: { onLoadProgress?: (p: number) => void }) => {
  options.onLoadProgress?.(0.5);
  options.onLoadProgress?.(1);
  return mockModel;
});
const getLlamaMock = vi.fn(async () => ({ loadModel: loadModelMock }));

vi.mock("node-llama-cpp", () => ({
  getLlama: (...args: unknown[]) => getLlamaMock(...(args as [])),
}));

let tmpDir: string;
let settingsPath: string;
let modelFile: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "public-data-ai-test-"));
  settingsPath = path.join(tmpDir, "model-settings.json");
  modelFile = path.join(tmpDir, "model.gguf");
  fs.writeFileSync(modelFile, "fake gguf content");
  loadModelMock.mockClear();
  getLlamaMock.mockClear();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ModelManager", () => {
  it("초기 상태는 unloaded이고 런타임이 없다", () => {
    const manager = new ModelManager(settingsPath);
    expect(manager.getStatus()).toEqual({ state: "unloaded" });
    expect(manager.getRuntime()).toBeUndefined();
  });

  it(".gguf가 아닌 파일은 로드를 거부한다", async () => {
    const notGguf = path.join(tmpDir, "model.bin");
    fs.writeFileSync(notGguf, "x");
    const manager = new ModelManager(settingsPath);
    const status = await manager.loadModel(notGguf);
    expect(status.state).toBe("error");
    expect(status.error).toMatch(/GGUF/);
    expect(getLlamaMock).not.toHaveBeenCalled();
  });

  it("존재하지 않는 파일은 로드를 거부한다", async () => {
    const manager = new ModelManager(settingsPath);
    const status = await manager.loadModel(path.join(tmpDir, "missing.gguf"));
    expect(status.state).toBe("error");
    expect(status.error).toMatch(/찾을 수 없습니다/);
  });

  it("정상적인 GGUF 파일을 로드하면 상태가 loaded가 되고 런타임을 사용할 수 있다", async () => {
    const manager = new ModelManager(settingsPath);
    const progressUpdates: number[] = [];
    manager.onStatusChange((s) => {
      if (s.state === "loading" && s.loadProgress !== undefined) {
        progressUpdates.push(s.loadProgress);
      }
    });

    const status = await manager.loadModel(modelFile);

    expect(status.state).toBe("loaded");
    expect(status.modelName).toBe("model.gguf");
    expect(manager.getRuntime()).toBeDefined();
    expect(progressUpdates).toEqual([0, 0.5, 1]);
  });

  it("로드 성공 시 모델 경로를 설정 파일에 저장한다", async () => {
    const manager = new ModelManager(settingsPath);
    await manager.loadModel(modelFile);

    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(saved.modelPath).toBe(modelFile);
  });

  it("unloadModel 이후에는 런타임이 사라지고 설정도 비워진다", async () => {
    const manager = new ModelManager(settingsPath);
    await manager.loadModel(modelFile);
    const status = await manager.unloadModel();

    expect(status.state).toBe("unloaded");
    expect(manager.getRuntime()).toBeUndefined();
    expect(mockContext.dispose).toHaveBeenCalled();
    expect(mockModel.dispose).toHaveBeenCalled();

    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(saved.modelPath).toBeUndefined();
  });

  it("restoreLastModel은 저장된 경로가 있으면 자동으로 다시 로드한다", async () => {
    const first = new ModelManager(settingsPath);
    await first.loadModel(modelFile);

    const second = new ModelManager(settingsPath);
    const status = await second.restoreLastModel();

    expect(status.state).toBe("loaded");
    expect(status.modelPath).toBe(modelFile);
  });

  it("restoreLastModel은 저장된 파일이 사라졌으면 오류 상태를 반환한다", async () => {
    fs.writeFileSync(settingsPath, JSON.stringify({ modelPath: path.join(tmpDir, "gone.gguf") }));
    const manager = new ModelManager(settingsPath);
    const status = await manager.restoreLastModel();

    expect(status.state).toBe("error");
    expect(status.error).toMatch(/찾을 수 없습니다/);
  });

  it("저장된 모델 경로가 없으면 restoreLastModel은 아무 것도 하지 않는다", async () => {
    const manager = new ModelManager(settingsPath);
    const status = await manager.restoreLastModel();
    expect(status.state).toBe("unloaded");
    expect(getLlamaMock).not.toHaveBeenCalled();
  });
});

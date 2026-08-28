import fs from "node:fs";
import path from "node:path";
import type { SlmRuntime } from "./inference/types";
import { NodeLlamaCppRuntime } from "./inference/nodeLlamaCppRuntime";

export type ModelState = "unloaded" | "loading" | "loaded" | "error";

export interface ModelStatus {
  state: ModelState;
  modelPath?: string;
  modelName?: string;
  /** 0(exclusive) ~ 1(inclusive). state가 "loading"일 때만 의미 있음 */
  loadProgress?: number;
  error?: string;
}

export type ModelStatusListener = (status: ModelStatus) => void;

interface PersistedSettings {
  modelPath?: string;
}

/**
 * 사용자가 업로드/선택한 GGUF 모델의 로드·해제·상태를 관리한다.
 *
 * - 사용자는 파일 시스템에서 .gguf 파일을 선택하기만 하면 되고, 별도의
 *   llama.cpp 서버를 직접 띄우거나 설정할 필요가 없다 (node-llama-cpp가
 *   프로세스 내에서 직접 추론한다).
 * - 마지막으로 로드했던 모델 경로는 로컬 설정 파일에 저장해, 다음 실행 시
 *   자동으로 다시 불러온다.
 */
export class ModelManager {
  private status: ModelStatus = { state: "unloaded" };
  private runtime: SlmRuntime | undefined;
  private llama: unknown;
  private model: unknown;
  private context: unknown;
  private readonly listeners = new Set<ModelStatusListener>();

  constructor(private readonly settingsPath: string) {}

  getStatus(): ModelStatus {
    return this.status;
  }

  /** state가 "loaded"일 때만 값을 반환한다. */
  getRuntime(): SlmRuntime | undefined {
    return this.status.state === "loaded" ? this.runtime : undefined;
  }

  onStatusChange(listener: ModelStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 앱 시작 시 1회 호출: 이전에 로드했던 모델이 있으면 자동으로 다시 로드를 시도한다. */
  async restoreLastModel(): Promise<ModelStatus> {
    const saved = this.readSettings();
    if (!saved.modelPath) return this.status;
    if (!fs.existsSync(saved.modelPath)) {
      this.setStatus({
        state: "error",
        modelPath: saved.modelPath,
        error: "이전에 사용하던 모델 파일을 찾을 수 없습니다. 다시 선택해주세요.",
      });
      return this.status;
    }
    return this.loadModel(saved.modelPath);
  }

  async loadModel(filePath: string): Promise<ModelStatus> {
    const validation = this.validatePath(filePath);
    if (validation) {
      this.setStatus({ state: "error", modelPath: filePath, error: validation });
      return this.status;
    }

    await this.disposeCurrent();
    this.setStatus({ state: "loading", modelPath: filePath, modelName: path.basename(filePath), loadProgress: 0 });

    try {
      const { getLlama } = (await import("node-llama-cpp")) as typeof import("node-llama-cpp");
      const llama = await getLlama();
      const model = await llama.loadModel({
        modelPath: filePath,
        onLoadProgress: (progress) => {
          this.setStatus({ ...this.status, state: "loading", loadProgress: progress });
        },
      });
      const context = await model.createContext();

      this.llama = llama;
      this.model = model;
      this.context = context;
      this.runtime = new NodeLlamaCppRuntime(context);

      this.writeSettings({ modelPath: filePath });
      this.setStatus({
        state: "loaded",
        modelPath: filePath,
        modelName: path.basename(filePath),
        loadProgress: 1,
      });
    } catch (err) {
      this.setStatus({
        state: "error",
        modelPath: filePath,
        modelName: path.basename(filePath),
        error: (err as Error).message,
      });
    }

    return this.status;
  }

  async unloadModel(): Promise<ModelStatus> {
    await this.disposeCurrent();
    this.writeSettings({ modelPath: undefined });
    this.setStatus({ state: "unloaded" });
    return this.status;
  }

  private validatePath(filePath: string): string | undefined {
    if (!filePath.toLowerCase().endsWith(".gguf")) {
      return "GGUF(.gguf) 파일만 선택할 수 있습니다.";
    }
    if (!fs.existsSync(filePath)) {
      return "파일을 찾을 수 없습니다.";
    }
    if (!fs.statSync(filePath).isFile()) {
      return "폴더가 아닌 파일을 선택해주세요.";
    }
    return undefined;
  }

  private async disposeCurrent(): Promise<void> {
    try {
      const context = this.context as { dispose?: () => Promise<void> } | undefined;
      await context?.dispose?.();
    } catch {
      /* 무시: 정리 과정의 실패로 다음 로드까지 막지 않는다 */
    }
    try {
      const model = this.model as { dispose?: () => Promise<void> } | undefined;
      await model?.dispose?.();
    } catch {
      /* noop */
    }
    this.llama = undefined;
    this.model = undefined;
    this.context = undefined;
    this.runtime = undefined;
  }

  private setStatus(status: ModelStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private readSettings(): PersistedSettings {
    try {
      if (!fs.existsSync(this.settingsPath)) return {};
      return JSON.parse(fs.readFileSync(this.settingsPath, "utf8")) as PersistedSettings;
    } catch {
      return {};
    }
  }

  private writeSettings(patch: PersistedSettings): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const current = this.readSettings();
      const next = { ...current, ...patch };
      fs.writeFileSync(this.settingsPath, JSON.stringify(next, null, 2), "utf8");
    } catch {
      /* 설정 저장 실패는 치명적이지 않으므로 무시한다 */
    }
  }
}

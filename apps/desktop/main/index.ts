/**
 * main/index.ts — Electron 메인 프로세스.
 *
 * Renderer는 Node.js API나 API Key에 직접 접근하지 않는다.
 * 모든 데이터 접근은 이 프로세스가 소유한 AppCore를 통해서만 이뤄지고,
 * Renderer와는 IPC로만 통신한다 (기술기획서 15장 "Electron 보안 구조" 참고).
 */
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { openDatabase } from "../../../core/db/schema";
import { createSlmRuntime } from "../../../core/llm/inference";
import { ModelManager } from "../../../core/llm/modelManager";
import { AppCore } from "../../../core/appCore";
import { writeExcelFile } from "../../../core/export/excelExporter";
import { writeCsvFile } from "../../../core/export/csvExporter";
import { IPC } from "./ipc";
import type { NormalizedResult } from "../../../core/types/domain";

let mainWindow: BrowserWindow | null = null;
let appCore: AppCore | null = null;

/**
 * 두 인스턴스가 동시에 뜨는 것을 막는다. sql.js는 DB 전체를 메모리에 올려두고
 * 쓸 때마다 파일 전체를 다시 쓰는 방식이라(core/db/schema.ts 참고), 실제
 * SQLite 파일과 달리 여러 프로세스가 동시에 같은 파일에 쓰면 나중에 저장한
 * 쪽이 앞선 쪽을 조용히 덮어써 대화 기록이 사라질 수 있다. 사용자가
 * run.bat을 두 번 누르는 등으로 이 상황이 생기지 않도록 먼저 막는다.
 */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getDbPath(): string {
  return process.env.APP_DB_PATH ?? path.join(app.getPath("userData"), "app.sqlite3");
}

function getModelSettingsPath(): string {
  return path.join(app.getPath("userData"), "model-settings.json");
}

async function initAppCore(): Promise<AppCore> {
  const db = await openDatabase(getDbPath());
  // 사용자가 GGUF 모델을 업로드하지 않았거나 로드에 실패했을 때 쓸 폴백
  // (llama.cpp 서버가 떠 있으면 그것을, 아니면 규칙 기반 폴백을 자동 선택한다).
  const fallbackRuntime = await createSlmRuntime();
  const modelManager = new ModelManager(getModelSettingsPath());
  const core = new AppCore(db, modelManager, fallbackRuntime);

  modelManager.onStatusChange((status) => {
    mainWindow?.webContents.send(IPC.modelStatusChanged, status);
  });
  // 이전에 사용하던 모델이 있으면 백그라운드에서 자동으로 다시 불러온다.
  // 창을 띄우는 걸 막지 않도록 await하지 않는다 — 진행 상황은 위 이벤트로 전달된다.
  void modelManager.restoreLastModel();

  return core;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Public Data AI",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    appCore = await initAppCore();
    registerIpcHandlers(appCore);
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function registerIpcHandlers(core: AppCore): void {
  ipcMain.handle(IPC.conversationCreate, (_event, title?: string) => {
    return core.conversations.createConversation(title);
  });

  ipcMain.handle(IPC.conversationList, () => {
    return core.conversations.listConversations();
  });

  ipcMain.handle(IPC.conversationMessages, (_event, conversationId: number) => {
    return core.conversations.listMessages(conversationId);
  });

  ipcMain.handle(IPC.conversationDelete, (_event, conversationId: number) => {
    core.conversations.deleteConversation(conversationId);
    return { ok: true };
  });

  ipcMain.handle(IPC.conversationDeleteMany, (_event, ids: number[]) => {
    core.conversations.deleteConversations(ids);
    return { ok: true };
  });

  ipcMain.handle(IPC.conversationDeleteAll, () => {
    core.conversations.deleteAllConversations();
    return { ok: true };
  });

  ipcMain.handle(IPC.cacheClearAll, () => {
    core.cache.clearAll();
    return { ok: true };
  });

  ipcMain.handle(IPC.chatAsk, async (_event, conversationId: number, text: string) => {
    return core.ask(conversationId, text);
  });

  ipcMain.handle(IPC.exportExcel, async (_event, result: NormalizedResult) => {
    return exportResult(result, "xlsx", (filePath) => writeExcelFile(result, filePath));
  });

  ipcMain.handle(IPC.exportCsv, async (_event, result: NormalizedResult) => {
    return exportResult(result, "csv", async (filePath) => writeCsvFile(result.rows, filePath));
  });

  ipcMain.handle(IPC.modelStatus, () => {
    return core.modelManager.getStatus();
  });

  // 파일 선택 대화상자를 띄우고, 고른 즉시 그 GGUF 파일을 로드한다.
  // 로딩은 시간이 걸릴 수 있어(대용량 모델) modelStatusChanged 이벤트로
  // 진행률을 별도로 밀어주고, 이 호출은 최종 결과가 나오면 resolve된다.
  ipcMain.handle(IPC.modelSelectFile, async () => {
    if (!mainWindow) return { canceled: true as const };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "GGUF 모델 파일 선택",
      filters: [{ name: "GGUF 모델", extensions: ["gguf"] }],
      properties: ["openFile"],
    });
    if (canceled || filePaths.length === 0) return { canceled: true as const };
    const status = await core.modelManager.loadModel(filePaths[0]);
    return { canceled: false as const, status };
  });

  ipcMain.handle(IPC.modelLoad, async (_event, filePath: string) => {
    return core.modelManager.loadModel(filePath);
  });

  ipcMain.handle(IPC.modelUnload, async () => {
    return core.modelManager.unloadModel();
  });
}

async function exportResult(
  result: NormalizedResult,
  extension: "xlsx" | "csv",
  write: (filePath: string) => Promise<void> | void
): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  if (!mainWindow) return { ok: false, error: "창을 찾을 수 없습니다." };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${result.entity}_${Date.now()}.${extension}`,
  });
  if (canceled || !filePath) return { ok: false, error: "취소되었습니다." };
  try {
    await write(filePath);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

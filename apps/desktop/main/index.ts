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
import { AppCore } from "../../../core/appCore";
import { writeExcelFile } from "../../../core/export/excelExporter";
import { writeCsvFile } from "../../../core/export/csvExporter";
import { IPC } from "./ipc";
import type { NormalizedResult } from "../../../core/types/domain";

let mainWindow: BrowserWindow | null = null;
let appCore: AppCore | null = null;

function getDbPath(): string {
  return process.env.APP_DB_PATH ?? path.join(app.getPath("userData"), "app.sqlite3");
}

async function initAppCore(): Promise<AppCore> {
  const db = openDatabase(getDbPath());
  const slm = await createSlmRuntime();
  return new AppCore(db, slm);
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

app.whenReady().then(async () => {
  appCore = await initAppCore();
  registerIpcHandlers(appCore);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

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

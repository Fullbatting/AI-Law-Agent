/**
 * preload/index.ts — Renderer가 안전하게 사용할 수 있는 최소한의 API만
 * contextBridge로 노출한다. nodeIntegration은 항상 꺼져 있다.
 */
import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../main/ipc";

const api = {
  createConversation: (title?: string) => ipcRenderer.invoke(IPC.conversationCreate, title),
  listConversations: () => ipcRenderer.invoke(IPC.conversationList),
  listMessages: (conversationId: number) =>
    ipcRenderer.invoke(IPC.conversationMessages, conversationId),
  deleteConversation: (conversationId: number) =>
    ipcRenderer.invoke(IPC.conversationDelete, conversationId),
  deleteConversations: (ids: number[]) => ipcRenderer.invoke(IPC.conversationDeleteMany, ids),
  deleteAllConversations: () => ipcRenderer.invoke(IPC.conversationDeleteAll),
  clearAllCache: () => ipcRenderer.invoke(IPC.cacheClearAll),
  ask: (conversationId: number, text: string) => ipcRenderer.invoke(IPC.chatAsk, conversationId, text),
  exportExcel: (result: unknown) => ipcRenderer.invoke(IPC.exportExcel, result),
  exportCsv: (result: unknown) => ipcRenderer.invoke(IPC.exportCsv, result),

  // GGUF 모델 관리
  getModelStatus: () => ipcRenderer.invoke(IPC.modelStatus),
  selectAndLoadModelFile: () => ipcRenderer.invoke(IPC.modelSelectFile),
  loadModelFile: (filePath: string) => ipcRenderer.invoke(IPC.modelLoad, filePath),
  unloadModel: () => ipcRenderer.invoke(IPC.modelUnload),
  onModelStatusChanged: (callback: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on(IPC.modelStatusChanged, handler);
    return () => ipcRenderer.removeListener(IPC.modelStatusChanged, handler);
  },

  // API 키 설정
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch: unknown) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
};

contextBridge.exposeInMainWorld("publicDataAI", api);

export type PublicDataAIBridge = typeof api;

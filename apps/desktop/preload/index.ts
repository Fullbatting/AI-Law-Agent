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
};

contextBridge.exposeInMainWorld("publicDataAI", api);

export type PublicDataAIBridge = typeof api;

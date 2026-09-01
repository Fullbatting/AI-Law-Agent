import type { ConversationSummary, MessageRecord } from "../../../core/conversation/conversationManager";
import type { AskResult } from "../../../core/appCore";
import type { NormalizedResult } from "../../../core/types/domain";
import type { ModelStatus } from "../../../core/llm/modelManager";
import type { AppSettings, CustomApiConfig } from "../../../core/settings/settingsManager";

export interface PublicDataAIBridge {
  createConversation(title?: string): Promise<ConversationSummary>;
  listConversations(): Promise<ConversationSummary[]>;
  listMessages(conversationId: number): Promise<MessageRecord[]>;
  deleteConversation(conversationId: number): Promise<{ ok: boolean }>;
  deleteConversations(ids: number[]): Promise<{ ok: boolean }>;
  deleteAllConversations(): Promise<{ ok: boolean }>;
  clearAllCache(): Promise<{ ok: boolean }>;
  ask(conversationId: number, text: string): Promise<AskResult>;
  exportExcel(result: NormalizedResult): Promise<{ ok: boolean; filePath?: string; error?: string }>;
  exportCsv(result: NormalizedResult): Promise<{ ok: boolean; filePath?: string; error?: string }>;

  // GGUF 모델 관리
  getModelStatus(): Promise<ModelStatus>;
  selectAndLoadModelFile(): Promise<{ canceled: true } | { canceled: false; status: ModelStatus }>;
  loadModelFile(filePath: string): Promise<ModelStatus>;
  unloadModel(): Promise<ModelStatus>;
  onModelStatusChanged(callback: (status: ModelStatus) => void): () => void;

  // API 키 설정
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: AppSettings): Promise<AppSettings>;

  // 커스텀(범용) API 등록
  addCustomApi(config: Omit<CustomApiConfig, "id">): Promise<CustomApiConfig>;
  removeCustomApi(id: string): Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    publicDataAI: PublicDataAIBridge;
  }
}

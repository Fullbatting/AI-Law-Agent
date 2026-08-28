import type { ConversationSummary, MessageRecord } from "../../../core/conversation/conversationManager";
import type { AskResult } from "../../../core/appCore";
import type { NormalizedResult } from "../../../core/types/domain";

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
}

declare global {
  interface Window {
    publicDataAI: PublicDataAIBridge;
  }
}

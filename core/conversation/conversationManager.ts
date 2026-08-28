import type Database from "better-sqlite3";
import type { QueryDSL } from "../query/dsl/types";
import type { NormalizedResult } from "../types/domain";

export type MessageRole = "user" | "assistant" | "system";

export interface ConversationSummary {
  id: number;
  title: string;
  createdAt: string;
}

export interface MessageRecord {
  id: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/**
 * 대화·API 호출·API 응답 이력 저장 및 삭제를 담당한다 (기술기획서 11장).
 * UI의 "[현재 대화 삭제] / [선택한 대화 삭제] / [전체 대화 삭제]" 기능을 그대로 지원한다.
 */
export class ConversationManager {
  constructor(private readonly db: Database.Database) {}

  createConversation(title = "새 대화"): ConversationSummary {
    const info = this.db
      .prepare("INSERT INTO conversations (title) VALUES (?)")
      .run(title);
    return this.getConversation(Number(info.lastInsertRowid))!;
  }

  getConversation(id: number): ConversationSummary | undefined {
    const row = this.db
      .prepare<[number], { id: number; title: string; created_at: string }>(
        "SELECT id, title, created_at FROM conversations WHERE id = ?"
      )
      .get(id);
    return row ? { id: row.id, title: row.title, createdAt: row.created_at } : undefined;
  }

  listConversations(): ConversationSummary[] {
    const rows = this.db
      .prepare<[], { id: number; title: string; created_at: string }>(
        "SELECT id, title, created_at FROM conversations ORDER BY created_at DESC"
      )
      .all();
    return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at }));
  }

  addMessage(conversationId: number, role: MessageRole, content: string): MessageRecord {
    const info = this.db
      .prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)")
      .run(conversationId, role, content);
    const id = Number(info.lastInsertRowid);
    const row = this.db
      .prepare<[number], { id: number; conversation_id: number; role: MessageRole; content: string; created_at: string }>(
        "SELECT id, conversation_id, role, content, created_at FROM messages WHERE id = ?"
      )
      .get(id)!;
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  listMessages(conversationId: number): MessageRecord[] {
    const rows = this.db
      .prepare<[number], { id: number; conversation_id: number; role: MessageRole; content: string; created_at: string }>(
        "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
      )
      .all(conversationId);
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
    }));
  }

  /** SLM이 호출한 QueryDSL과 그 결과를 이력으로 남긴다 (감사/재현용) */
  recordApiCall(messageId: number, dsl: QueryDSL, result: NormalizedResult): void {
    const requestInfo = this.db
      .prepare("INSERT INTO api_requests (message_id, connector, query_dsl_json) VALUES (?, ?, ?)")
      .run(messageId, dsl.source, JSON.stringify(dsl));
    this.db
      .prepare(
        "INSERT INTO api_responses (request_id, normalized_json, source_label) VALUES (?, ?, ?)"
      )
      .run(Number(requestInfo.lastInsertRowid), JSON.stringify(result), result.sourceLabel);
  }

  deleteConversation(id: number): void {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }

  deleteConversations(ids: number[]): void {
    const stmt = this.db.prepare("DELETE FROM conversations WHERE id = ?");
    const tx = this.db.transaction((idList: number[]) => {
      for (const id of idList) stmt.run(id);
    });
    tx(ids);
  }

  deleteAllConversations(): void {
    this.db.prepare("DELETE FROM conversations").run();
  }
}

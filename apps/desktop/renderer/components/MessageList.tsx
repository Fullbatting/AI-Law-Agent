import React from "react";
import type { MessageRecord } from "../../../../core/conversation/conversationManager";
import type { NormalizedResult } from "../../../../core/types/domain";
import { ResultTable } from "./ResultTable";

interface ChatEntry {
  message: MessageRecord;
  results?: NormalizedResult[];
}

interface Props {
  entries: ChatEntry[];
  isLoading: boolean;
}

export function MessageList({ entries, isLoading }: Props): JSX.Element {
  return (
    <div className="message-list">
      {entries.length === 0 && !isLoading && (
        <div className="empty-hint">
          예) "서울에 있는 종합병원 목록을 보여줘." / "개인정보를 수집할 때 적용되는 법령을 찾아줘."
        </div>
      )}
      {entries.map(({ message, results }) => (
        <div key={message.id} className={`message message-${message.role}`}>
          <div className="message-role">{roleLabel(message.role)}</div>
          <div className="message-content">{message.content}</div>
          {results?.map((result, i) => <ResultTable key={i} result={result} />)}
        </div>
      ))}
      {isLoading && (
        <div className="message message-assistant">
          <div className="message-role">AI</div>
          <div className="message-content">데이터를 조회하고 있습니다…</div>
        </div>
      )}
    </div>
  );
}

function roleLabel(role: MessageRecord["role"]): string {
  if (role === "user") return "사용자";
  if (role === "assistant") return "AI";
  return "시스템";
}

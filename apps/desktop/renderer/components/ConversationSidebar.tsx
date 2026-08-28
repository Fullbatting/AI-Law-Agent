import React from "react";
import type { ConversationSummary } from "../../../../core/conversation/conversationManager";

interface Props {
  conversations: ConversationSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDeleteCurrent: () => void;
  onDeleteAll: () => void;
  onClearCache: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDeleteCurrent,
  onDeleteAll,
  onClearCache,
}: Props): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Public Data AI</span>
        <button type="button" onClick={onCreate} title="새 대화">
          +
        </button>
      </div>
      <ul className="conversation-list">
        {conversations.map((c) => (
          <li
            key={c.id}
            className={c.id === activeId ? "active" : ""}
            onClick={() => onSelect(c.id)}
          >
            {c.title}
          </li>
        ))}
      </ul>
      <div className="sidebar-actions">
        <button type="button" onClick={onDeleteCurrent}>
          현재 대화 삭제
        </button>
        <button type="button" onClick={onDeleteAll}>
          전체 대화 삭제
        </button>
        <button type="button" onClick={onClearCache}>
          API 캐시 삭제
        </button>
      </div>
    </aside>
  );
}

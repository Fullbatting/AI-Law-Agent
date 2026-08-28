import React, { useEffect, useState } from "react";
import "./types";
import type { ConversationSummary, MessageRecord } from "../../../core/conversation/conversationManager";
import type { NormalizedResult } from "../../../core/types/domain";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";

interface ChatEntry {
  message: MessageRecord;
  results?: NormalizedResult[];
}

export function App(): JSX.Element {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const list = await window.publicDataAI.listConversations();
    if (list.length > 0) {
      setConversations(list);
      await selectConversation(list[0].id);
      return;
    }
    const created = await window.publicDataAI.createConversation();
    setConversations([created]);
    setActiveId(created.id);
  }

  async function selectConversation(id: number) {
    setActiveId(id);
    const messages = await window.publicDataAI.listMessages(id);
    setEntries(messages.map((message) => ({ message })));
  }

  async function handleCreate() {
    const created = await window.publicDataAI.createConversation();
    setConversations((prev) => [created, ...prev]);
    setActiveId(created.id);
    setEntries([]);
  }

  async function handleDeleteCurrent() {
    if (activeId === null) return;
    await window.publicDataAI.deleteConversation(activeId);
    const list = await window.publicDataAI.listConversations();
    setConversations(list);
    if (list.length > 0) {
      await selectConversation(list[0].id);
    } else {
      await handleCreate();
    }
  }

  async function handleDeleteAll() {
    await window.publicDataAI.deleteAllConversations();
    await handleCreate();
    setConversations([]);
    await bootstrap();
  }

  async function handleClearCache() {
    await window.publicDataAI.clearAllCache();
  }

  async function handleSend(text: string) {
    if (activeId === null) return;
    setEntries((prev) => [
      ...prev,
      { message: { id: Date.now(), conversationId: activeId, role: "user", content: text, createdAt: new Date().toISOString() } },
    ]);
    setIsLoading(true);
    try {
      const response = await window.publicDataAI.ask(activeId, text);
      setEntries((prev) => [
        ...prev,
        {
          message: {
            id: Date.now() + 1,
            conversationId: activeId,
            role: "assistant",
            content: response.message,
            createdAt: new Date().toISOString(),
          },
          results: response.results,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => void selectConversation(id)}
        onCreate={() => void handleCreate()}
        onDeleteCurrent={() => void handleDeleteCurrent()}
        onDeleteAll={() => void handleDeleteAll()}
        onClearCache={() => void handleClearCache()}
      />
      <main className="chat-panel">
        <MessageList entries={entries} isLoading={isLoading} />
        <InputBar disabled={isLoading || activeId === null} onSend={(text) => void handleSend(text)} />
      </main>
    </div>
  );
}

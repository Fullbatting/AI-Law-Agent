import { describe, expect, it } from "vitest";
import { openInMemoryDatabase } from "../../core/db/schema";
import { ConversationManager } from "../../core/conversation/conversationManager";

describe("ConversationManager", () => {
  it("대화를 생성하고 메시지를 순서대로 저장한다", () => {
    const manager = new ConversationManager(openInMemoryDatabase());
    const conversation = manager.createConversation("테스트 대화");
    manager.addMessage(conversation.id, "user", "안녕");
    manager.addMessage(conversation.id, "assistant", "안녕하세요");

    const messages = manager.listMessages(conversation.id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("현재 대화를 삭제하면 메시지도 함께 사라진다 (CASCADE)", () => {
    const manager = new ConversationManager(openInMemoryDatabase());
    const conversation = manager.createConversation();
    manager.addMessage(conversation.id, "user", "질문");
    manager.deleteConversation(conversation.id);

    expect(manager.getConversation(conversation.id)).toBeUndefined();
    expect(manager.listMessages(conversation.id)).toHaveLength(0);
  });

  it("전체 대화 삭제가 동작한다", () => {
    const manager = new ConversationManager(openInMemoryDatabase());
    manager.createConversation("A");
    manager.createConversation("B");
    manager.deleteAllConversations();
    expect(manager.listConversations()).toHaveLength(0);
  });

  it("선택한 여러 대화만 삭제할 수 있다", () => {
    const manager = new ConversationManager(openInMemoryDatabase());
    const a = manager.createConversation("A");
    const b = manager.createConversation("B");
    const c = manager.createConversation("C");
    manager.deleteConversations([a.id, b.id]);

    const remaining = manager.listConversations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(c.id);
  });
});

/** Renderer ↔ Main 프로세스 간 IPC 채널 이름을 한 곳에서 관리한다. */
export const IPC = {
  chatAsk: "chat:ask",
  conversationList: "conversation:list",
  conversationCreate: "conversation:create",
  conversationMessages: "conversation:messages",
  conversationDelete: "conversation:delete",
  conversationDeleteMany: "conversation:deleteMany",
  conversationDeleteAll: "conversation:deleteAll",
  cacheClearAll: "cache:clearAll",
  exportExcel: "export:excel",
  exportCsv: "export:csv",
} as const;

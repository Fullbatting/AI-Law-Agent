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
  modelSelectFile: "model:selectFile",
  modelLoad: "model:load",
  modelUnload: "model:unload",
  modelStatus: "model:status",
  /** main → renderer 전용 이벤트 (모델 로딩 진행률 등 상태 변화 push) */
  modelStatusChanged: "model:statusChanged",
  settingsGet: "settings:get",
  settingsUpdate: "settings:update",
  customApiAdd: "settings:customApiAdd",
  customApiRemove: "settings:customApiRemove",
} as const;

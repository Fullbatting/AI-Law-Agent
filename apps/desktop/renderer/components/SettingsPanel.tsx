import React, { useEffect, useState } from "react";
import type { AppSettings } from "../../../../core/settings/settingsManager";
import { SettingsModal } from "./SettingsModal";

/**
 * 사이드바에 표시되는 "API 키 설정" 진입 버튼.
 * 실제 입력 화면은 별도의 전체 화면 모달(SettingsModal)로 띄운다 — 작은
 * 접이식 패널에 숨어 있으면 처음 쓰는 사용자가 찾기 어렵기 때문이다.
 * 배지(연결됨/미설정)는 모달을 닫을 때마다 최신 설정을 다시 읽어 갱신한다.
 */
export function SettingsPanel(): JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    const settings: AppSettings = await window.publicDataAI.getSettings();
    setIsConfigured(
      (settings.hiraServiceKey ?? "").trim().length > 0 || (settings.lawApiOc ?? "").trim().length > 0
    );
  }

  function handleClose() {
    setModalOpen(false);
    void refreshStatus();
  }

  return (
    <div className="settings-panel">
      <button type="button" className="settings-panel-toggle" onClick={() => setModalOpen(true)}>
        <span>API 키 설정</span>
        <span className={isConfigured ? "settings-badge settings-badge-ok" : "settings-badge"}>
          {isConfigured ? "연결됨" : "미설정"}
        </span>
      </button>
      {modalOpen && <SettingsModal onClose={handleClose} />}
    </div>
  );
}

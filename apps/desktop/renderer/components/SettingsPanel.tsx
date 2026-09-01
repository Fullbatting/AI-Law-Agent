import React, { useEffect, useState } from "react";
import type { AppSettings } from "../../../../core/settings/settingsManager";

/**
 * 사이드바에 표시되는 공공데이터 API 키 설정 패널.
 * 이전에는 .env 파일을 직접 열어 편집해야만 HIRA_SERVICE_KEY / LAW_API_OC를
 * 넣을 수 있었다. 이 패널에서 입력해 저장하면 즉시 반영되며(앱 재시작 불필요),
 * Connector들은 요청 시점마다 SettingsManager에서 최신 값을 다시 읽는다
 * (core/settings/settingsManager.ts, core/tools/registry.ts 참고).
 */
export function SettingsPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [hiraServiceKey, setHiraServiceKey] = useState("");
  const [lawApiOc, setLawApiOc] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    window.publicDataAI.getSettings().then((settings: AppSettings) => {
      setHiraServiceKey(settings.hiraServiceKey ?? "");
      setLawApiOc(settings.lawApiOc ?? "");
    });
  }, []);

  async function handleSave() {
    setBusy(true);
    try {
      const saved = await window.publicDataAI.updateSettings({
        hiraServiceKey: hiraServiceKey.trim(),
        lawApiOc: lawApiOc.trim(),
      });
      setHiraServiceKey(saved.hiraServiceKey ?? "");
      setLawApiOc(saved.lawApiOc ?? "");
      setSavedAt(Date.now());
    } finally {
      setBusy(false);
    }
  }

  const isConfigured = hiraServiceKey.trim().length > 0 || lawApiOc.trim().length > 0;

  return (
    <div className="settings-panel">
      <button
        type="button"
        className="settings-panel-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span>API 키 설정</span>
        <span className={isConfigured ? "settings-badge settings-badge-ok" : "settings-badge"}>
          {isConfigured ? "연결됨" : "미설정"}
        </span>
      </button>
      {open && (
        <div className="settings-panel-body">
          <label className="settings-field">
            <span>건강보험심사평가원(HIRA) 서비스키</span>
            <input
              type="password"
              value={hiraServiceKey}
              onChange={(e) => setHiraServiceKey(e.target.value)}
              placeholder="공공데이터포털에서 발급받은 서비스키"
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>법제처 Open API 인증키(OC)</span>
            <input
              type="text"
              value={lawApiOc}
              onChange={(e) => setLawApiOc(e.target.value)}
              placeholder="예: 이메일 아이디 부분"
              autoComplete="off"
            />
          </label>
          <button type="button" onClick={() => void handleSave()} disabled={busy}>
            저장
          </button>
          {savedAt !== null && <div className="settings-saved-hint">저장되었습니다. 바로 적용됩니다.</div>}
          <p className="settings-help">
            공공데이터포털(data.go.kr)에서 병원정보서비스와 법제처 API 활용 신청 후
            발급받은 값을 입력하세요. 값은 이 컴퓨터에만 저장되며 외부로 전송되지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}

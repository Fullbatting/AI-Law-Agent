import React, { useEffect, useState } from "react";
import type { AppSettings } from "../../../../core/settings/settingsManager";
import { detectApiKeyKind, extractOcFromValue } from "../../../../core/settings/detectApiKeyKind";

interface Props {
  onClose: () => void;
}

/**
 * 별도의 "API 키 설정" 화면(모달). 사이드바 한 켠의 작은 패널이 아니라
 * 전체 창을 덮는 독립된 화면으로 띄워, 처음 쓰는 사용자도 확실하게 찾을 수
 * 있게 한다.
 *
 * 상단의 "빠른 등록" 입력란은 HIRA 서비스키인지 법제처 OC인지 사용자가
 * 미리 고르지 않아도, 붙여넣은 값의 생김새만 보고 자동으로 구분해서 채워
 * 넣는다(core/settings/detectApiKeyKind.ts). 두 값 다 그 자체에 "이건 HIRA
 * 키" 같은 표시가 있는 건 아니라서 100% 확신할 수는 없다 — 애매하면 추측하는
 * 대신 사용자에게 직접 골라 달라고 보여준다.
 */
export function SettingsModal({ onClose }: Props): JSX.Element {
  const [hiraServiceKey, setHiraServiceKey] = useState("");
  const [lawApiOc, setLawApiOc] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [quickPaste, setQuickPaste] = useState("");
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const [pendingUnknownValue, setPendingUnknownValue] = useState<string | null>(null);

  useEffect(() => {
    window.publicDataAI.getSettings().then((settings: AppSettings) => {
      setHiraServiceKey(settings.hiraServiceKey ?? "");
      setLawApiOc(settings.lawApiOc ?? "");
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

  function applyQuickPaste() {
    const value = quickPaste.trim();
    if (!value) return;
    const kind = detectApiKeyKind(value);
    if (kind === "hira") {
      setHiraServiceKey(value);
      setQuickMessage("HIRA(건강보험심사평가원) 서비스키로 인식해 채워 넣었습니다. 아래에서 확인 후 저장하세요.");
      setPendingUnknownValue(null);
    } else if (kind === "law") {
      setLawApiOc(extractOcFromValue(value));
      setQuickMessage("법제처 Open API 인증키(OC)로 인식해 채워 넣었습니다. 아래에서 확인 후 저장하세요.");
      setPendingUnknownValue(null);
    } else {
      setQuickMessage(null);
      setPendingUnknownValue(value);
    }
    setQuickPaste("");
  }

  function assignPendingValue(target: "hira" | "law") {
    if (pendingUnknownValue === null) return;
    if (target === "hira") {
      setHiraServiceKey(pendingUnknownValue);
      setQuickMessage("HIRA 서비스키로 등록했습니다. 아래에서 확인 후 저장하세요.");
    } else {
      setLawApiOc(extractOcFromValue(pendingUnknownValue));
      setQuickMessage("법제처 OC로 등록했습니다. 아래에서 확인 후 저장하세요.");
    }
    setPendingUnknownValue(null);
  }

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>API 키 설정</h2>
          <button type="button" className="settings-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="settings-modal-body">
          <section className="settings-quick-section">
            <div className="settings-field">
              <span>빠른 등록 — 키를 붙여넣으면 어느 서비스 것인지 자동으로 판단합니다</span>
              <div className="settings-quick-row">
                <input
                  type="text"
                  value={quickPaste}
                  onChange={(e) => setQuickPaste(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyQuickPaste();
                  }}
                  placeholder="발급받은 API 키를 여기에 붙여넣으세요"
                  autoComplete="off"
                />
                <button type="button" onClick={applyQuickPaste}>
                  자동 등록
                </button>
              </div>
            </div>
            {quickMessage && <div className="settings-saved-hint">{quickMessage}</div>}
            {pendingUnknownValue !== null && (
              <div className="settings-unknown-box">
                <p>어느 서비스의 키인지 자동으로 판단하지 못했습니다. 직접 골라주세요.</p>
                <div className="settings-unknown-actions">
                  <button type="button" onClick={() => assignPendingValue("hira")}>
                    HIRA 서비스키로 등록
                  </button>
                  <button type="button" onClick={() => assignPendingValue("law")}>
                    법제처 OC로 등록
                  </button>
                </div>
              </div>
            )}
          </section>

          <hr className="settings-divider" />

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

          <p className="settings-help">
            공공데이터포털(data.go.kr)에서 병원정보서비스와 법제처 API 활용 신청 후
            발급받은 값을 입력하세요. 값은 이 컴퓨터에만 저장되며 외부로 전송되지
            않습니다. HIRA 키는 "일반 인증키(Decoding)"와 "(Encoding)" 어느 쪽을
            붙여넣어도 자동으로 올바르게 처리됩니다.
          </p>
        </div>

        <div className="settings-modal-footer">
          {savedAt !== null && <span className="settings-saved-hint">저장되었습니다. 바로 적용됩니다.</span>}
          <button type="button" className="settings-modal-save" onClick={() => void handleSave()} disabled={busy}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

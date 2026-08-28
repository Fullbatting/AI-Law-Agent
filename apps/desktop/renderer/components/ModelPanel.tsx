import React, { useEffect, useState } from "react";
import type { ModelStatus } from "../../../../core/llm/modelManager";

/**
 * 사이드바에 표시되는 로컬 SLM(GGUF) 관리 패널.
 * 사용자는 파일 시스템에서 .gguf 파일을 선택하기만 하면 되고, 별도의
 * llama.cpp 서버 설정 없이 바로 사용할 수 있다 (프로세스 내 추론).
 * 모델을 로드하지 않았거나 로드에 실패하면 규칙 기반 폴백으로 계속 동작한다.
 */
export function ModelPanel(): JSX.Element {
  const [status, setStatus] = useState<ModelStatus>({ state: "unloaded" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.publicDataAI.getModelStatus().then(setStatus);
    const unsubscribe = window.publicDataAI.onModelStatusChanged(setStatus);
    return unsubscribe;
  }, []);

  async function handleSelect() {
    setBusy(true);
    try {
      const result = await window.publicDataAI.selectAndLoadModelFile();
      if (!result.canceled) setStatus(result.status);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnload() {
    setBusy(true);
    try {
      setStatus(await window.publicDataAI.unloadModel());
    } finally {
      setBusy(false);
    }
  }

  const isLoading = status.state === "loading";

  return (
    <div className="model-panel">
      <div className="model-panel-header">로컬 SLM (GGUF)</div>
      {renderStatus(status)}
      <div className="model-panel-actions">
        <button type="button" onClick={() => void handleSelect()} disabled={busy || isLoading}>
          {status.state === "loaded" ? "다른 모델 선택" : "GGUF 모델 업로드"}
        </button>
        {status.state === "loaded" && (
          <button type="button" onClick={() => void handleUnload()} disabled={busy}>
            모델 해제
          </button>
        )}
      </div>
    </div>
  );
}

function renderStatus(status: ModelStatus): JSX.Element {
  switch (status.state) {
    case "unloaded":
      return (
        <div className="model-status model-status-unloaded">
          모델 미로드 — 규칙 기반 폴백으로 동작 중
        </div>
      );
    case "loading": {
      const percent = Math.round((status.loadProgress ?? 0) * 100);
      return (
        <div className="model-status model-status-loading">
          <div className="model-progress-bar">
            <div className="model-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span>
            {status.modelName} 로딩 중... {percent}%
          </span>
        </div>
      );
    }
    case "loaded":
      return (
        <div className="model-status model-status-loaded" title={status.modelPath}>
          ✓ {status.modelName}
        </div>
      );
    case "error":
      return (
        <div className="model-status model-status-error" title={status.modelPath}>
          오류: {status.error}
        </div>
      );
  }
}

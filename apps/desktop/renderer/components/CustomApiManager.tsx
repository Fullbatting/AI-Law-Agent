import React, { useEffect, useState } from "react";
import type { AppSettings, CustomApiConfig } from "../../../../core/settings/settingsManager";

type AuthType = CustomApiConfig["authType"];

const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  query: "쿼리 파라미터",
  header: "HTTP 헤더",
  bearer: "Bearer 토큰",
  none: "인증 없음",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  baseUrl: "",
  docsUrl: "",
  authType: "query" as AuthType,
  authKeyName: "",
  authValue: "",
  searchParamName: "",
  extraQueryParams: "",
};

/**
 * HIRA/법제처처럼 코드로 미리 만들어둔 게 아니라, 사용자가 화면에서 직접
 * 등록하는 "범용 커스텀 API" 관리 섹션.
 *
 * 여기 등록한 API는 core/tools/registry.ts를 거쳐 CustomApiConnector로
 * 실제 호출되고, 자연어 질문이 왔을 때 어느 API로 보낼지는:
 * 1) GGUF 모델이 로드되어 있으면 모델이 이름+설명을 보고 직접 고르고,
 * 2) 모델이 없으면(규칙 기반 폴백) 질문에 이 API 이름이 그대로 언급됐는지,
 *    아니면 이름/설명과 질문 단어가 겹치는지로 자동 추정한다
 *    (core/llm/inference/ruleBasedFallback.ts 참고) — 애매하면 지금까지
 *    처리해온 병원 검색으로 넘어간다.
 * 그래서 "설명"을 최대한 구체적으로 적어둘수록 자동 분류가 정확해진다.
 */
export function CustomApiManager(): JSX.Element {
  const [apis, setApis] = useState<CustomApiConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const settings: AppSettings = await window.publicDataAI.getSettings();
    setApis(settings.customApis ?? []);
  }

  function updateForm<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd() {
    setError(null);
    const name = form.name.trim();
    const baseUrl = form.baseUrl.trim();
    if (!name || !baseUrl) {
      setError("서비스 이름과 Base URL은 필수입니다.");
      return;
    }
    setBusy(true);
    try {
      await window.publicDataAI.addCustomApi({
        name,
        baseUrl,
        docsUrl: form.docsUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        authType: form.authType,
        authKeyName: form.authKeyName.trim() || undefined,
        authValue: form.authValue.trim() || undefined,
        searchParamName: form.searchParamName.trim() || undefined,
        extraQueryParams: form.extraQueryParams.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(true);
    try {
      await window.publicDataAI.removeCustomApi(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const needsAuthKeyName = form.authType === "query" || form.authType === "header";

  return (
    <section className="custom-api-section">
      <div className="custom-api-header">
        <span>커스텀 API 관리 — 어떤 공공/외부 API든 등록해 쓸 수 있습니다</span>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "닫기" : "+ 새 API 추가"}
        </button>
      </div>

      {apis.length > 0 && (
        <ul className="custom-api-list">
          {apis.map((api) => (
            <li key={api.id}>
              <div className="custom-api-list-info">
                <strong>{api.name}</strong>
                <span className="custom-api-list-url">{api.baseUrl}</span>
                {api.description && <span className="custom-api-list-desc">{api.description}</span>}
              </div>
              <button type="button" onClick={() => void handleRemove(api.id)} disabled={busy}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {apis.length === 0 && !showForm && (
        <p className="settings-help">등록된 커스텀 API가 없습니다. "+ 새 API 추가"를 눌러 등록하세요.</p>
      )}

      {showForm && (
        <div className="custom-api-form">
          <label className="settings-field">
            <span>서비스 이름 *</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="예: 기상청 단기예보"
            />
          </label>
          <label className="settings-field">
            <span>이 API가 무엇을 조회하는지 설명 (자동 분류 정확도에 도움)</span>
            <input
              type="text"
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="예: 지역별 날씨/기온/강수확률 조회"
            />
          </label>
          <label className="settings-field">
            <span>Base URL *</span>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => updateForm("baseUrl", e.target.value)}
              placeholder="https://apis.data.go.kr/..."
            />
          </label>
          <label className="settings-field">
            <span>키를 발급받은 곳 URL (참고용, 선택)</span>
            <input
              type="text"
              value={form.docsUrl}
              onChange={(e) => updateForm("docsUrl", e.target.value)}
              placeholder="https://www.data.go.kr/data/..."
            />
          </label>
          <label className="settings-field">
            <span>인증 방식</span>
            <select value={form.authType} onChange={(e) => updateForm("authType", e.target.value as AuthType)}>
              {(Object.keys(AUTH_TYPE_LABELS) as AuthType[]).map((type) => (
                <option key={type} value={type}>
                  {AUTH_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          {needsAuthKeyName && (
            <label className="settings-field">
              <span>{form.authType === "query" ? "인증 쿼리 파라미터 이름" : "인증 헤더 이름"}</span>
              <input
                type="text"
                value={form.authKeyName}
                onChange={(e) => updateForm("authKeyName", e.target.value)}
                placeholder={form.authType === "query" ? "예: serviceKey" : "예: X-API-Key"}
              />
            </label>
          )}
          {form.authType !== "none" && (
            <label className="settings-field">
              <span>인증 키 값</span>
              <input
                type="password"
                value={form.authValue}
                onChange={(e) => updateForm("authValue", e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <label className="settings-field">
            <span>검색어를 실어 보낼 파라미터 이름 (선택)</span>
            <input
              type="text"
              value={form.searchParamName}
              onChange={(e) => updateForm("searchParamName", e.target.value)}
              placeholder="예: query, keyword, q (비워두면 검색어 없이 고정 파라미터로만 호출)"
            />
          </label>
          <label className="settings-field">
            <span>항상 붙일 고정 파라미터 (선택)</span>
            <input
              type="text"
              value={form.extraQueryParams}
              onChange={(e) => updateForm("extraQueryParams", e.target.value)}
              placeholder="예: dataType=JSON&numOfRows=20"
            />
          </label>
          {error && <div className="custom-api-error">{error}</div>}
          <button type="button" onClick={() => void handleAdd()} disabled={busy}>
            등록
          </button>
        </div>
      )}

      <p className="settings-help">
        지원 범위는 "검색어 하나 + 고정 파라미터"로 호출하고, 응답 JSON 안에서
        배열처럼 보이는 부분을 찾아 표로 보여주는 수준입니다. HIRA/법제처처럼
        필드별로 깔끔하게 정리되진 않지만, 등록 즉시 자연어 질문에서 자동으로
        (또는 질문에 서비스 이름을 직접 언급해서) 사용할 수 있습니다.
      </p>
    </section>
  );
}

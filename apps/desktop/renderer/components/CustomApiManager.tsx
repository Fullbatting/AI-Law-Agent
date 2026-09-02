import React, { useEffect, useState } from "react";
import type { AppSettings, CustomApiConfig } from "../../../../core/settings/settingsManager";

type AuthType = CustomApiConfig["authType"];
type HttpMethod = NonNullable<CustomApiConfig["httpMethod"]>;

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
  httpMethod: "GET" as HttpMethod,
  searchParamName: "",
  extraQueryParams: "",
  requestBodyTemplate: "",
  extraHeaders: "",
  exampleQuestions: "",
};

/**
 * HIRA/법제처처럼 코드로 미리 만들어둔 게 아니라, 사용자가 화면에서 직접
 * 등록하는 "범용 API" 관리 섹션. GET/POST, 쿼리·헤더·Bearer 인증, 추가 헤더,
 * POST 본문 템플릿까지 지원해서 대부분의 REST API를 코드 수정 없이 등록할
 * 수 있게 하는 것이 목표다.
 *
 * 여기 등록한 API는 core/tools/registry.ts를 거쳐 CustomApiConnector로
 * 실제 호출되고, 자연어 질문이 왔을 때 어느 API로 보낼지는:
 * 1) GGUF 모델이 로드되어 있으면 모델이 이름+설명+예시 질문을 보고 직접 고르고,
 * 2) 모델이 없으면(규칙 기반 폴백) 질문에 이 API 이름이 그대로 언급됐는지,
 *    아니면 이름/설명/예시 질문과 질문 단어가 겹치는지로 자동 추정한다
 *    (core/llm/inference/ruleBasedFallback.ts 참고) — 애매하면 지금까지
 *    처리해온 병원 검색으로 넘어간다.
 * "설명"과 "예시 질문"을 구체적으로 적어둘수록(특히 예시 질문은 가중치가
 * 더 높다) 자동 분류가 정확해진다 — 이 화면에서 그 정보를 직접 요청한다.
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
      const exampleQuestions = form.exampleQuestions
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      await window.publicDataAI.addCustomApi({
        name,
        baseUrl,
        docsUrl: form.docsUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        authType: form.authType,
        authKeyName: form.authKeyName.trim() || undefined,
        authValue: form.authValue.trim() || undefined,
        httpMethod: form.httpMethod,
        searchParamName: form.searchParamName.trim() || undefined,
        extraQueryParams: form.extraQueryParams.trim() || undefined,
        requestBodyTemplate: form.requestBodyTemplate.trim() || undefined,
        extraHeaders: form.extraHeaders.trim() || undefined,
        exampleQuestions: exampleQuestions.length > 0 ? exampleQuestions : undefined,
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
  const isPost = form.httpMethod === "POST";

  return (
    <section className="custom-api-section">
      <div className="custom-api-header">
        <span>API 등록 — GET/POST, 인증 방식에 상관없이 거의 모든 API를 등록할 수 있습니다</span>
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
                <span className="custom-api-list-url">
                  {api.httpMethod === "POST" ? "POST " : "GET "}
                  {api.baseUrl}
                </span>
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
        <p className="settings-help">등록된 API가 없습니다. "+ 새 API 추가"를 눌러 등록하세요.</p>
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
            <span>
              이런 질문이 오면 이 API로 보내주세요 (한 줄에 하나, 인식 정확도를 크게 높여줍니다)
            </span>
            <textarea
              value={form.exampleQuestions}
              onChange={(e) => updateForm("exampleQuestions", e.target.value)}
              placeholder={"예)\n서울 날씨 알려줘\n내일 비 와?\n부산 기온 몇 도야"}
              rows={3}
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
            <span>요청 방식</span>
            <select
              value={form.httpMethod}
              onChange={(e) => updateForm("httpMethod", e.target.value as HttpMethod)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
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
            <span>검색어를 실어 보낼 쿼리 파라미터 이름 (선택)</span>
            <input
              type="text"
              value={form.searchParamName}
              onChange={(e) => updateForm("searchParamName", e.target.value)}
              placeholder="예: query, keyword, q (비워두면 검색어 없이 고정 파라미터로만 호출)"
            />
          </label>
          {isPost && (
            <label className="settings-field">
              <span>
                POST 요청 본문(JSON). {"{{query}}"} 자리에 검색어가 안전하게 치환됩니다
              </span>
              <textarea
                value={form.requestBodyTemplate}
                onChange={(e) => updateForm("requestBodyTemplate", e.target.value)}
                placeholder={'예: {"keyword": "{{query}}", "numOfRows": 20}'}
                rows={2}
              />
            </label>
          )}
          <label className="settings-field">
            <span>항상 붙일 고정 쿼리 파라미터 (선택)</span>
            <input
              type="text"
              value={form.extraQueryParams}
              onChange={(e) => updateForm("extraQueryParams", e.target.value)}
              placeholder="예: dataType=JSON&numOfRows=20"
            />
          </label>
          <label className="settings-field">
            <span>추가 헤더 (선택, 인증 헤더 외에 더 필요할 때. 한 줄에 하나, "Key: Value" 형식)</span>
            <textarea
              value={form.extraHeaders}
              onChange={(e) => updateForm("extraHeaders", e.target.value)}
              placeholder={"예)\nAccept: application/json\nX-Client-Id: my-app"}
              rows={2}
            />
          </label>
          {error && <div className="custom-api-error">{error}</div>}
          <button type="button" onClick={() => void handleAdd()} disabled={busy}>
            등록
          </button>
        </div>
      )}

      <p className="settings-help">
        지원 범위는 "검색어 하나 + 고정 파라미터/헤더/본문"으로 호출하고, 응답
        JSON 안에서 배열처럼 보이는 부분을 찾아 표로 보여주는 수준입니다.
        HIRA/법제처처럼 필드별로 깔끔하게 정리되진 않지만, 등록 즉시 자연어
        질문에서 자동으로(또는 질문에 서비스 이름을 직접 언급해서) 사용할 수
        있습니다.
      </p>
    </section>
  );
}

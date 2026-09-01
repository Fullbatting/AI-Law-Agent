# 아키텍처 개요

이 문서는 `docs/technical_plan.md`(기술기획서)에서 정의한 구조를 실제 저장소
디렉터리/모듈에 매핑한 것이다. 전체 배경과 설계 근거는 기술기획서를 참고한다.

## 계층 구조

```text
자연어 → SLM → Query DSL → Schema Validator → Tool Router → Connector → API
   → 원본 데이터 → Data Processor → 결과 → SLM → 사용자
```

## 로컬 저장소로 sql.js를 쓰는 이유

`core/db/schema.ts`는 네이티브 애드온이 아니라 [sql.js](https://sql.js.org)
(WebAssembly로 컴파일된 SQLite)를 쓴다. 실제로 Electron에서 직접 검증해보고
내린 결정이다:

- `better-sqlite3` — Windows에서 사전 빌드 바이너리가 있어도 npm이
  `binding.gyp` 존재만으로 `node-gyp rebuild`를 자동 실행해 Visual Studio
  Build Tools 없는 PC에서 설치가 실패했다. `@electron/rebuild`로 Electron용
  바이너리를 다시 받아도 실제 Electron 프로세스 안에서 실행하면 **SIGSEGV로
  죽었다** (N-API 기반이라 Node/Electron 어디서나 안전할 거라 예상했지만
  실측 결과는 아니었다).
- Node 내장 `node:sqlite` — 시스템에 설치된 Node가 아무리 최신이어도
  **Electron 메인 프로세스는 Electron이 자체 내장한 Node로 돈다** (예:
  Electron 32는 Node 20.18.1을 내장하며, 이 버전엔 `node:sqlite`가
  아예 없다). 그래서 `npm install`/타입체크/테스트는 다 통과해도 실제
  앱 실행 시 `ERR_UNKNOWN_BUILTIN_MODULE`로 즉시 죽었다.
- sql.js는 순수 WASM이라 네이티브 바인딩/ABI 문제 자체가 없다. 실제로
  헤드리스 Electron에서 앱을 띄워 SQLite 파일이 정상 생성되는 것까지
  확인했다. 대신 `.export()`로 통째로 직렬화해 파일에 써야 해서, 매
  쓰기 작업 후 전체 DB를 디스크에 다시 쓴다 — 이 프로젝트 규모(로컬
  대화/캐시)에서는 문제되지 않는다.
- 다만 이 방식은 실제 SQLite 파일과 달리 여러 프로세스가 동시에 같은
  파일에 써도 막아주는 잠금이 없다 — 두 인스턴스가 동시에 뜨면 나중에
  저장한 쪽이 앞선 대화 기록을 조용히 덮어쓸 수 있다. 그래서
  `apps/desktop/main/index.ts`에 `app.requestSingleInstanceLock()`을
  걸어 앱을 두 번 띄우는 것 자체를 막는다(두 번째 실행은 기존 창을
  포커스만 하고 종료된다).

`AppDatabase`/`PreparedStatement` 어댑터가 `.prepare(sql).run()/.get()/.all()`
같은 익숙한 모양을 그대로 유지해줘서, `CacheManager`/`ConversationManager`
쪽 코드는 DB 구현이 세 번 바뀌는 동안 전혀 손대지 않았다.

## SLM 런타임 우선순위

`AppCore`가 `QueryPlanner`에 넘기는 `SlmRuntime`은 매 질의마다 다음 순서로
결정된다 (`core/appCore.ts`의 `slmProvider`):

1. 사용자가 사이드바에서 업로드해 로드된 GGUF 모델(`ModelManager.getRuntime()`,
   node-llama-cpp로 프로세스 내 추론)
2. 없으면 `LLAMA_SERVER_URL`에 떠 있는 외부 llama.cpp 서버
   (`core/llm/inference/llamaCppRuntime.ts`)
3. 그마저 없으면 규칙 기반 폴백(`ruleBasedFallback.ts`)

세 구현 모두 `SlmRuntime` 인터페이스(`core/llm/inference/types.ts`)를 따르므로
Query Planner/Tool Router 이하 코드는 어떤 런타임이 실제로 쓰이는지 몰라도 된다.

`SlmRuntime`은 두 메서드로 SLM의 서로 다른 두 역할을 분리한다 (계층 구조
다이어그램의 앞뒤 두 SLM 지점에 대응):

- `complete()` — 자연어 질문을 Query DSL JSON으로 변환 (`QueryPlanner`가 호출)
- `summarize()` — Tool Router가 이미 조회해온 결과를 자연어 설명으로 풀어줌
  (`AppCore.ask()`가 호출). 프롬프트에는 결과 데이터(표본 최대 10행)만
  넘기고 새로운 사실을 지어내지 말라고 명시한다 (`core/llm/prompt/summarizePrompt.ts`).
  실패하거나 규칙 기반 폴백일 때는 `buildTemplateSummary()`의 고정 문구로
  대체되므로 `ask()`가 실패하지 않는다. 어느 경우든 원본 표(`NormalizedResult`)는
  요약 문장과 별개로 항상 함께 반환되어 UI가 그대로 보여준다.

## 디렉터리 ↔ 역할 매핑

| 디렉터리 | 역할 | 기술기획서 참고 |
|---|---|---|
| `apps/desktop/main` | Electron 메인 프로세스, IPC 핸들러, AppCore 소유 | 3장, 15장 |
| `apps/desktop/preload` | contextBridge로 Renderer에 최소 API만 노출 | 15장 |
| `apps/desktop/renderer` | React 기반 채팅/결과 UI | 13장 |
| `core/llm` | 시스템 프롬프트, few-shot, Query DSL Zod 스키마, SLM 런타임(GGUF/llama.cpp 서버/규칙 기반 폴백) | 5장, 17장 |
| `core/llm/modelManager.ts` | 사용자가 업로드한 GGUF 모델의 로드/해제/상태 관리, node-llama-cpp로 프로세스 내 추론 | 17장 |
| `core/settings/settingsManager.ts` | 앱 내 "API 키 설정" 화면에서 입력한 `HIRA_SERVICE_KEY`/`LAW_API_OC`를 `userData/app-settings.json`에 저장·조회 (없으면 `.env`로 폴백). Connector가 요청마다 다시 읽어 재시작 없이 즉시 반영 | 15장 |
| `core/planner` | 자연어 → QueryPlan 변환 + 검증 실패 시 재생성 요청 | 5장, 25장 |
| `core/tools` | Tool Registry(허용된 Connector 목록), Tool Router(실행) | 6장 |
| `core/permission` | 등록되지 않은 source/entity, 과도한 limit 차단 | 25장 |
| `core/query` | Query DSL 타입 정의 및 Zod 검증기 | 10장 |
| `core/dataProcessing` | filter/sort/group/aggregate/select/join 파이프라인 | 9장, 10장 |
| `core/db/schema.ts` | sql.js(WASM SQLite) 위에 better-sqlite3 스타일 API(`prepare().run()/.get()/.all()`)를 얹은 어댑터 + 스키마 | 11장 |
| `core/cache` | Connector별 TTL을 적용한 SQLite 캐시 | 12장 |
| `core/conversation` | 대화/메시지/API 호출 이력 저장 및 삭제 | 11장 |
| `core/export` | Excel/CSV 내보내기 | 9장, 13장 |
| `connectors/hira`, `connectors/law` | 실제 공공 API 호출 및 정규화 | 4장, 7장, 8장 |
| `connectors/generic/customApiConnector.ts` | 사용자가 설정 화면에서 등록한 임의의(범용) API용 Connector. 필드별 매핑 코드 없이 "검색어 하나 + 고정 파라미터"로 호출하고, 응답에서 배열처럼 보이는 부분을 찾아 표로 정규화하는 휴리스틱을 쓴다 | 4장, 6장 |
| `connectors/common` | 공용 HTTP 클라이언트, XML/JSON 파서, 응답 검증 | 4장 |
| `data/dictionaries` | 지역명·기관코드 등 자연어 ↔ API 코드 매핑 테이블 | 8장 |
| `data/schemas` | Connector별 원본/정규화 데이터 Zod 스키마 | 25장 |

## 확장 방법

새로운 기관 API(질병관리청, 통계청 등)를 **코드로 제대로** 추가하려면:

1. `connectors/<기관>/` 아래에 `ApiConnector` 인터페이스를 구현하는 파일 추가
2. `core/tools/registry.ts`의 `defaultConnectors()`에 등록
3. 필요한 경우 `data/dictionaries`, `data/schemas`에 코드 매핑/스키마 추가
4. `core/llm/prompt/fewShot.ts`에 few-shot 예시 추가

코드를 건드리지 않고 **앱 화면에서 바로** API를 늘리려면 "API 키 설정"
화면의 "커스텀 API 관리" 섹션을 쓴다(README "커스텀(범용) API 등록" 참고).
`AppCore.refreshCustomApis()`가 `SettingsManager.getCustomApis()`를 다시 읽어
`ToolRegistry`에 `custom:<id>` source로 등록/해제하므로, `ToolRegistry`·
`ToolRouter`·`PermissionManager`는 source/entity를 그냥 문자열로만 다뤄
코드 변경 없이 그대로 동작한다. 다만 `CustomApiConnector`는 필드별 매핑이
없는 범용 Connector라 표현력이 떨어진다 — 실제 서비스에 오래 쓸 API라면
결국 1~4번처럼 전용 Connector를 만드는 편이 낫다.

### 자연어 질문을 어느 Connector로 보낼지 정하는 방법

`QueryPlanner`(`core/planner/queryPlanner.ts`)가 `ToolRegistry.describeForPrompt()`
로 만든 "허용된 데이터 소스" 목록을 시스템 프롬프트에 그대로 넣어 SLM에게
넘긴다 — Connector를 추가해도 이 프롬프트 생성 코드는 그대로다. GGUF 모델이
로드되어 있으면 모델이 이 목록을 보고 source/entity를 직접 고른다. 모델이
없어 규칙 기반 폴백(`core/llm/inference/ruleBasedFallback.ts`)이 대신
동작할 때는, 새로 만든 전용 Connector라면 그 폴백에 직접 규칙을 추가해야
하지만, 커스텀 API로 등록한 경우엔 이름 언급/키워드 겹침 기반의 범용 라우팅
규칙이 이미 자동으로 적용된다(README "자동 분류 vs 직접 지정" 참고).

SLM/Planner/Tool Router/Data Processor 코드는 수정할 필요가 없다 — 이것이
Query DSL + Tool Registry + Connector 구조를 초기부터 분리한 이유다.

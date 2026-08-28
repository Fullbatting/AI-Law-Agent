# 아키텍처 개요

이 문서는 `docs/technical_plan.md`(기술기획서)에서 정의한 구조를 실제 저장소
디렉터리/모듈에 매핑한 것이다. 전체 배경과 설계 근거는 기술기획서를 참고한다.

## 계층 구조

```text
자연어 → SLM → Query DSL → Schema Validator → Tool Router → Connector → API
   → 원본 데이터 → Data Processor → 결과 → SLM → 사용자
```

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
| `core/planner` | 자연어 → QueryPlan 변환 + 검증 실패 시 재생성 요청 | 5장, 25장 |
| `core/tools` | Tool Registry(허용된 Connector 목록), Tool Router(실행) | 6장 |
| `core/permission` | 등록되지 않은 source/entity, 과도한 limit 차단 | 25장 |
| `core/query` | Query DSL 타입 정의 및 Zod 검증기 | 10장 |
| `core/dataProcessing` | filter/sort/group/aggregate/select/join 파이프라인 | 9장, 10장 |
| `core/cache` | Connector별 TTL을 적용한 SQLite 캐시 | 12장 |
| `core/conversation` | 대화/메시지/API 호출 이력 저장 및 삭제 | 11장 |
| `core/export` | Excel/CSV 내보내기 | 9장, 13장 |
| `connectors/hira`, `connectors/law` | 실제 공공 API 호출 및 정규화 | 4장, 7장, 8장 |
| `connectors/common` | 공용 HTTP 클라이언트, XML/JSON 파서, 응답 검증 | 4장 |
| `data/dictionaries` | 지역명·기관코드 등 자연어 ↔ API 코드 매핑 테이블 | 8장 |
| `data/schemas` | Connector별 원본/정규화 데이터 Zod 스키마 | 25장 |

## 확장 방법

새로운 기관 API(질병관리청, 통계청 등)를 추가하려면:

1. `connectors/<기관>/` 아래에 `ApiConnector` 인터페이스를 구현하는 파일 추가
2. `core/tools/registry.ts`의 `defaultConnectors()`에 등록
3. 필요한 경우 `data/dictionaries`, `data/schemas`에 코드 매핑/스키마 추가
4. `core/llm/prompt/fewShot.ts`에 few-shot 예시 추가

SLM/Planner/Tool Router/Data Processor 코드는 수정할 필요가 없다 — 이것이
Query DSL + Tool Registry + Connector 구조를 초기부터 분리한 이유다.

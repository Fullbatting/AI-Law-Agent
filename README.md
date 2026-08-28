# Public Data AI

건강보험심사평가원(HIRA)·법제처 등 공공 API를 자연어로 검색·가공하는
**로컬 SLM 기반 Electron 데스크톱 에이전트**.

> 전체 설계 배경과 근거는 [`docs/technical_plan.md`](docs/technical_plan.md)
> (기술기획서)를 참고한다. 이 README는 실제 저장소를 실행/개발하는 방법을 다룬다.

## 핵심 아이디어

```text
자연어 → Local SLM(3~5B) → Query DSL → Schema Validator → Tool Router
   → API Connector → 공공 API → Data Processor(filter/sort/group/aggregate)
   → 표/그래프/엑셀 + Local SLM의 자연어 설명
```

LLM은 데이터를 직접 판단하거나 임의로 API를 호출하지 않는다. 오직 "어떤
데이터를 어떻게 가져올지"를 나타내는 **Query DSL**을 생성할 뿐이고, 실제
조회·필터링·집계는 검증된 프로그램 코드가 담당한다 (`docs/architecture/overview.md` 참고).

## 저장소 구조

```text
public-data-ai/
├─ apps/desktop/       # Electron 앱 (main / preload / renderer)
├─ core/               # LLM 연동, Query Planner, Tool Router, 캐시, 대화 저장, 데이터 가공
├─ connectors/         # HIRA, 법제처 등 실제 API Connector
├─ data/               # 코드 매핑 사전, 정규화 스키마
├─ tests/              # Vitest 단위 테스트
└─ docs/               # 아키텍처/API/라이선스 문서, 기술기획서
```

## 사전 요구 사항

- Node.js 20+ (권장 22)
- (선택) [llama.cpp](https://github.com/ggerganov/llama.cpp)의 `llama-server`로
  구동한 3~5B급 GGUF 모델 — 없으면 자동으로 규칙 기반 폴백 SLM을 사용해
  파이프라인 전체를 그대로 개발/테스트할 수 있다.
- 공공데이터포털에서 발급받은 HIRA 서비스키, 법제처 오픈API 이용자 ID(OC)

## 시작하기

```bash
git clone https://github.com/Fullbatting/AI-Law-Agent.git
cd AI-Law-Agent
npm install
cp .env.example .env   # HIRA_SERVICE_KEY, LAW_API_OC 등을 채워 넣는다
```

### 개발 실행 (Electron)

```bash
npm start          # build 후 Electron 창을 띄운다
```

llama.cpp 서버(`LLAMA_SERVER_URL`, 기본 `http://127.0.0.1:8080`)가 떠 있지
않으면 `core/llm/inference/ruleBasedFallback.ts`의 규칙 기반 폴백이 자동으로
대신 동작한다 (개발/데모용).

### 타입 체크 / 테스트

```bash
npm run typecheck
npm test
```

### 배포 패키지 빌드

```bash
npm run package:win     # Windows NSIS 인스톨러
npm run package:mac     # macOS DMG
npm run package:linux   # Linux AppImage
```

결과물은 `release/` 폴더에 생성된다.

## 환경 변수 (`.env`)

| 변수 | 설명 |
|---|---|
| `HIRA_SERVICE_KEY` | 공공데이터포털 HIRA 병원정보서비스 서비스키 |
| `LAW_API_OC` | 법제처 국가법령정보 오픈API 이용자 이메일 ID |
| `LLAMA_SERVER_URL` | llama.cpp `llama-server` 엔드포인트 (기본 `http://127.0.0.1:8080`) |
| `APP_DB_PATH` | 대화/캐시 SQLite 파일 경로 (Electron 실행 시 기본값은 `userData` 아래) |

## 사용 예시 질문

- "서울에 있는 종합병원 목록을 보여줘."
- "서울 종합병원 중 응급실이 있는 곳만 보여줘."
- "병원명, 주소, 전화번호만 표로 만들어줘."
- "지역별 병원 수를 집계해줘."
- "이 결과를 엑셀로 저장해줘."
- "개인정보를 수집할 때 적용되는 법령을 찾아줘."

## 개발 단계 (Roadmap)

`docs/technical_plan.md` 23장 기준:

- **Phase 1 (현재)** — Electron + Local SLM + HIRA + 법제처 + Chat UI + SQLite 대화 저장
- **Phase 2** — 필터/정렬/집계/그룹화, CSV·Excel 내보내기, API 캐시 (이 저장소는 Phase 1/2 핵심 파이프라인을 함께 갖추고 있다)
- **Phase 3** — 여러 API 연속 호출, Join, Task Planning, 자동 재시도
- **Phase 4** — Skill 단위 플랫폼 확장 (질병관리청, 식약처, 통계청 등)

## 라이선스

프로그램 소스는 [Apache License 2.0](LICENSE)을 따른다. Local SLM 모델과
HIRA·법제처 데이터의 이용조건은 별도이므로 [`docs/license/README.md`](docs/license/README.md)를 반드시 확인한다.

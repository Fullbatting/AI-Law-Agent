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
├─ install.bat         # Windows: 처음 설치할 때 한 번 실행 (npm install + 빌드)
├─ run.bat             # Windows: 설치 후 프로그램 실행
├─ apps/desktop/       # Electron 앱 (main / preload / renderer)
├─ core/               # LLM 연동, Query Planner, Tool Router, 캐시, 대화 저장, 데이터 가공
├─ connectors/         # HIRA, 법제처 등 실제 API Connector
├─ data/               # 코드 매핑 사전, 정규화 스키마
├─ scripts/            # build-installer.bat 등 배포용 보조 스크립트
├─ tests/              # Vitest 단위 테스트
└─ docs/               # 아키텍처/API/라이선스 문서, 기술기획서
```

## 사전 요구 사항

- Node.js 18 이상 — [nodejs.org](https://nodejs.org)에서 설치.
  대화·캐시 저장에는 [sql.js](https://sql.js.org)(WebAssembly로 컴파일된 SQLite)를
  쓰기 때문에 네이티브 애드온 컴파일이나 별도 빌드 도구 없이 `npm install`만으로 동작하고,
  Electron이 내장한 Node 버전과도 무관하게 항상 동일하게 동작한다.
- (선택) 3~5B급 **GGUF 모델 파일** — 앱을 실행한 뒤 사이드바에서 파일을
  선택하기만 하면 된다 (아래 "로컬 SLM(GGUF) 사용하기" 참고). 모델을
  올리지 않아도 규칙 기반 폴백 SLM으로 파이프라인 전체를 그대로 개발/테스트할 수 있다.
- 공공데이터포털에서 발급받은 HIRA 서비스키, 법제처 오픈API 이용자 ID(OC)

## 로컬 SLM(GGUF) 사용하기

이 앱은 [node-llama-cpp](https://github.com/withcatai/node-llama-cpp)를 통해
GGUF 모델을 **Electron 프로세스 안에서 직접** 구동한다. 별도의 llama.cpp
서버를 띄우거나 포트를 설정할 필요가 없다.

1. 앱을 실행하면 사이드바 아래쪽에 **"로컬 SLM (GGUF)"** 패널이 보인다.
2. **GGUF 모델 업로드** 버튼을 눌러 `.gguf` 파일을 선택한다.
   - [Hugging Face](https://huggingface.co/models?library=gguf)에서
     3~5B급 한국어 지원 모델(GGUF 포맷)을 미리 받아두면 된다
     (기술기획서 17~18장의 모델 선정 기준 참고).
3. 로딩 진행률이 진행바로 표시되고, 완료되면 초록색 체크와 함께 모델 이름이
   표시된다. 이후 질문부터 바로 이 모델이 자연어 → Query DSL 변환에 쓰인다.
4. 마지막으로 로드한 모델 경로는 자동 저장되어, 다음에 앱을 실행하면
   다시 자동으로 불러온다. **모델 해제** 버튼으로 언제든 내릴 수 있다.

모델을 올리지 않았거나 로드에 실패하면 자동으로 규칙 기반 폴백(또는
`LLAMA_SERVER_URL`에 별도 llama.cpp 서버를 띄워둔 경우 그 서버)으로
전환되므로 앱 자체가 멈추지는 않는다.

> **참고**: GGUF 모델 파일과 node-llama-cpp의 플랫폼별 바이너리는 용량이
> 크다(수백 MB~수 GB). 첫 `npm install`/`install.bat` 실행 시 인터넷
> 상황에 따라 시간이 걸릴 수 있다.

## Windows에서 압축파일로 다운받아 설치하기 (Git/CLI 지식 불필요)

1. GitHub 저장소 페이지 → **Code → Download ZIP**으로 소스를 내려받는다.
2. 원하는 폴더에 압축을 푼다.
3. **`install.bat`을 더블클릭**한다.
   - Node.js 설치 여부를 확인하고, 없으면 설치 안내 후 종료한다.
   - `npm install`로 의존성을 설치한다.
   - `.env.example`을 복사해 `.env`를 만든다.
   - 앱을 빌드한다 (`dist/` 생성).
4. 폴더에 생성된 **`.env` 파일을 메모장으로 열어** `HIRA_SERVICE_KEY`,
   `LAW_API_OC` 값을 채워 넣는다 (공공데이터포털/법제처에서 미리 발급받아야 함).
5. **`run.bat`을 더블클릭**하면 Electron 창이 뜨며 프로그램이 시작된다.
   이후에는 `install.bat`을 다시 실행할 필요 없이 `run.bat`만 실행하면 된다.

`install.bat`/`run.bat`은 더블클릭 시 자기 자신을 새 콘솔 창으로 다시 실행하고,
성공/실패 어느 경로든 마지막에 "아무 키나 누르면 닫힙니다"로 멈춘다 — 그래서
로그를 다 읽은 뒤 **키를 누르면 창이 자동으로 닫힌다**. 아무 키도 누르지 않으면
당연히 계속 떠 있다. 그래도 안내와 다르게 동작한다면:

- 탐색기 압축 해제 화면(ZIP 미리보기)에서 바로 실행한 것은 아닌지 확인하고,
  반드시 "압축 풀기"로 완전히 해제한 폴더에서 실행한다.
- Windows가 "PC 보호" 경고를 띄우면 **추가 정보 → 실행**을 눌러야 스크립트가
  진행된다.
- 그래도 원인을 알 수 없다면 `Win+R` → `cmd` → 압축 푼 폴더로 `cd` 이동 →
  `install.bat` 을 직접 입력해 실행하면, 창이 사용자가 직접 연 것이라 어떤
  경우에도 닫히지 않고 전체 로그를 확인할 수 있다.

> 배포용 단일 설치 프로그램(.exe 인스톨러)이 필요하다면
> `scripts\build-installer.bat`을 실행한다. `electron-builder`로 NSIS
> 인스톨러를 만들어 `release\` 폴더에 생성한다 (배포 대상 PC에는 Node.js가
> 필요 없다).

## 소스에서 직접 개발하기 (git 사용)

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

사이드바에서 GGUF 모델을 업로드하지 않았고, `LLAMA_SERVER_URL`(기본
`http://127.0.0.1:8080`)에 별도 llama.cpp 서버도 떠 있지 않으면
`core/llm/inference/ruleBasedFallback.ts`의 규칙 기반 폴백이 자동으로
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

결과물은 `release/` 폴더에 생성된다. Windows에서는 `scripts\build-installer.bat`
더블클릭으로 동일한 작업(`npm run package:win`)을 수행할 수 있다.

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

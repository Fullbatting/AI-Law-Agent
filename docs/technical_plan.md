# 공공데이터 자연어 AI 검색·가공 프로그램 기술기획서

## 1. 프로젝트 개요

### 1.1 프로젝트 가칭
**Public Data AI**

### 1.2 핵심 목표

건강보험심사평가원(HIRA)과 법제처에서 제공하는 공공 API를 하나의 프로그램에서 편리하게 활용할 수 있도록 하고, 사용자가 API 구조나 파라미터를 직접 알지 않아도 자연어로 데이터를 검색·조회·가공할 수 있도록 하는 것을 목표로 한다.

핵심은 **5~7B 미만의 소형 로컬 SLM**을 활용하여 자연어를 구조화된 질의(Query)로 변환하고, 실제 데이터 조회 및 계산은 프로그램이 담당하도록 하는 것이다.

### 1.3 핵심 사용자 경험

사용자는 챗봇과 대화하듯 질문한다.

예:
- "서울에 있는 종합병원 목록을 보여줘."
- "서울 종합병원 중 응급실이 있는 곳만 보여줘."
- "병원명, 주소, 전화번호만 표로 만들어줘."
- "지역별 병원 수를 집계해줘."
- "이 결과를 엑셀로 저장해줘."
- "개인정보를 수집할 때 적용되는 법령을 찾아줘."

프로그램은 자연어를 분석한 뒤 적절한 API를 선택하고, 필요한 파라미터를 생성하여 API를 호출한다. 이후 원본 데이터를 구조화하고 필터링·정렬·집계·변환한 뒤 사용자에게 표, 그래프 또는 자연어 설명으로 제공한다.

---

# 2. 핵심 설계 철학

이 시스템에서 SLM이 모든 일을 수행하도록 설계해서는 안 된다.

## 역할 분리

| 구성요소 | 역할 |
|---|---|
| Local SLM | 자연어 이해, 의도 분류, 파라미터 추출, Tool 선택, Query DSL 생성, 결과 설명 |
| Query Planner | 사용자의 요청을 실행 가능한 작업 계획으로 변환 |
| Tool Router | 허용된 Tool/API 선택 및 실행 |
| API Connector | HIRA·법제처 등 실제 API 호출 |
| Data Normalizer | JSON/XML 등의 원본 데이터를 내부 표준 구조로 변환 |
| Data Processor | 필터·정렬·집계·그룹화·결합 |
| Cache Manager | API 응답 및 대화 캐시 관리 |
| SQLite | 대화·캐시·실행 이력 저장 |
| Electron UI | 채팅 및 데이터 결과 표시 |

핵심 원칙:

> **LLM은 데이터를 직접 판단하거나 임의로 API를 호출하는 주체가 아니라, 프로그램이 데이터를 가져오고 가공하도록 지시하는 인터페이스로 사용한다.**

---

# 3. 전체 시스템 구조

```text
┌───────────────────────────────────────────────┐
│                  Electron UI                  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ 사용자 질문                             │  │
│  │ "서울 종합병원 중 응급실 있는 곳?"     │  │
│  └──────────────────────┬──────────────────┘  │
│                         ↓                     │
│              Chat / Result UI                 │
└─────────────────────────┬─────────────────────┘
                          │ IPC
                          ↓
┌───────────────────────────────────────────────┐
│                Application Core                │
│                                               │
│ Conversation Manager                          │
│ Query Planner                                 │
│ Tool Router                                   │
│ Cache Manager                                 │
│ Permission Manager                            │
└───────────┬──────────────┬────────────────────┘
            │              │
            ↓              ↓
┌─────────────────┐  ┌─────────────────────────┐
│ Local SLM       │  │ API Connector           │
│ 3B~5B           │  │                         │
│                 │  │ HIRA                    │
│ Intent          │  │ 법제처                  │
│ Query           │  │ 향후 공공데이터포털     │
│ Tool selection  │  │ 기타 API                │
└─────────────────┘  └────────────┬────────────┘
                                  ↓
                         External API
                                  ↓
                         JSON / XML / etc.
                                  ↓
┌───────────────────────────────────────────────┐
│               Data Processing                 │
│                                               │
│ Parser                                        │
│ Normalizer                                    │
│ Filter                                        │
│ Sort                                          │
│ Aggregate                                     │
│ Formatter                                     │
└────────────────────────┬──────────────────────┘
                         ↓
                    Result Data
                         ↓
                    Local SLM
                         ↓
                   자연어 설명
```

---

# 4. API Connector 아키텍처

API를 코드에 직접 하드코딩하지 않고 **Connector/Plugin 구조**로 설계한다.

## 초기 Connector

```text
/connectors
   /hira
      hospital.py
      disease.py
      medical_institution.py

   /law
      law_search.py
      law_detail.py
      terminology.py

   /common
      api_client.py
      parser.py
      validator.py
```

## 공통 Connector 인터페이스

각 Connector는 다음 정보를 제공한다.

```text
API Connector

- name
- description
- authentication
- endpoints
- parameters
- request()
- response_schema()
- normalize()
```

이 구조를 사용하면 향후 다음 기관을 추가하기 쉽다.

```text
HIRA
법제처
공공데이터포털
질병관리청
식품의약품안전처
국민건강보험공단
통계청
보건복지부
```

---

# 5. 자연어 → Query DSL

프로젝트의 핵심 기술로 **내부 표준 Query DSL**을 정의한다.

사용자 질문:

> 서울에 있는 종합병원 20개를 병원명과 주소만 보여줘.

SLM 출력 예:

```json
{
  "source": "hira",
  "operation": "search",
  "entity": "hospital",
  "filters": [
    {
      "field": "region",
      "operator": "eq",
      "value": "서울"
    },
    {
      "field": "hospital_type",
      "operator": "eq",
      "value": "종합병원"
    }
  ],
  "select": [
    "name",
    "address"
  ],
  "sort": {
    "field": "name",
    "order": "asc"
  },
  "limit": 20
}
```

## 실행 흐름

```text
사용자 자연어
      ↓
Local SLM
      ↓
Query DSL
      ↓
Schema Validator
      ↓
Tool Router
      ↓
API Connector
      ↓
API
      ↓
원본 데이터
      ↓
Data Processor
      ↓
결과
      ↓
Local SLM
      ↓
사용자 설명
```

---

# 6. Tool 기반 API 호출

LLM이 직접 URL을 생성하거나 임의의 API를 호출하지 않도록 한다.

## 권장 구조

```text
Local SLM
   ↓
허용된 Tool 선택
   ↓
Query JSON
   ↓
Schema Validation
   ↓
API Connector
   ↓
External API
```

예:

```text
hira_hospital_search
hira_disease_search
hira_medical_institution_detail

law_search
law_article
law_term_search

data_filter
data_sort
data_group
data_export_excel
data_export_csv
```

## 장점

- 허용된 기능만 실행 가능
- 잘못된 API 호출 방지
- LLM Hallucination 감소
- API Key 노출 방지
- 기능 추가가 쉬움
- 향후 Agent/Skill 구조로 확장 가능

---

# 7. 법제처 API 활용 방향

법제처 API는 단순 법령 검색뿐 아니라 법령 목록·본문 검색, 지능형 법령검색, 일상용어와 법령용어 연계 등의 기능을 활용할 수 있다.

예:

> 개인정보를 몰래 수집하면 어떤 법을 위반할 수 있어?

처리 흐름:

```text
자연어 질문
 ↓
법률 관련 의도 분류
 ↓
검색어 및 법령용어 생성
 ↓
법제처 API
 ↓
관련 법령 검색
 ↓
법령 본문 조회
 ↓
관련 조문 추출
 ↓
원문 근거 표시
 ↓
SLM을 통한 쉬운 설명
```

## 주의사항

법률 영역에서는 SLM이 법적 판단을 확정적으로 내리도록 하면 안 된다.

따라서 결과에 다음을 함께 표시하는 구조를 권장한다.

- 법령명
- 조문
- 시행일
- 검색/조회 시점
- 원문 데이터
- 출처
- AI 설명

AI 설명과 법령 원문을 명확히 분리한다.

---

# 8. HIRA API 활용 방향

초기에는 HIRA에서 제공하는 병원·의료기관·질병 관련 API를 중심으로 구성한다.

예:

```text
HIRA
 ├─ 병원정보
 ├─ 의료기관 상세정보
 ├─ 질병 관련 정보
 └─ 향후 추가 가능한 HIRA Open API
```

사용자 질문을 API별 Tool로 변환한다.

예:

```text
"서울 종합병원 찾아줘"
        ↓
hira_hospital_search
        ↓
지역 = 서울
종별 = 종합병원
```

---

# 9. 자연어 데이터 가공

단순 검색에 그치지 않고 데이터 조작 기능까지 지원한다.

## 지원 대상

### 필터

> 서울에 있는 병원만 보여줘.

### 컬럼 선택

> 병원명과 주소만 보여줘.

### 정렬

> 가나다순으로 정렬해줘.

### 상위 N개

> 10개만 보여줘.

### 그룹화

> 지역별 병원 수를 알려줘.

### 집계

> 지역별 평균값을 계산해줘.

### 데이터 결합

> 서울 병원정보와 질병정보를 비교해줘.

### 파일 출력

> 엑셀로 만들어줘.

---

# 10. Query DSL 설계

향후 API 종류가 증가해도 동일한 자연어 처리 구조를 사용할 수 있도록 내부 Query DSL을 표준화한다.

예:

```json
{
  "source": "hira",
  "operation": "search",
  "entity": "hospital",
  "filters": [],
  "select": [],
  "sort": null,
  "group_by": [],
  "aggregate": [],
  "limit": 50
}
```

지원할 수 있는 기본 Operation:

```text
search
get
filter
sort
group
aggregate
join
compare
export
```

이렇게 설계하면 API가 달라져도 SLM은 동일한 DSL을 생성하고 Connector가 실제 API 문법으로 변환할 수 있다.

---

# 11. 채팅 및 캐시 저장

SQLite를 권장한다.

```text
SQLite
│
├── conversations
├── messages
├── api_requests
├── api_responses
└── cache
```

## 저장 정보 예

```text
conversation
 ├─ 사용자 질문
 ├─ SLM 분석 결과
 ├─ 호출 API
 ├─ API 요청 파라미터
 ├─ API 응답
 ├─ 최종 답변
 └─ timestamp
```

## 삭제 기능

UI에서 다음 기능을 제공한다.

```text
[현재 대화 삭제]

[선택한 대화 삭제]

[전체 대화 삭제]

[API 응답 캐시 삭제]

[전체 캐시 삭제]
```

사용자가 원할 경우 모든 로컬 대화 및 캐시를 즉시 삭제할 수 있도록 한다.

---

# 12. API Response Cache

동일한 API 요청을 반복하는 경우 캐시를 활용한다.

```text
사용자 질문
 ↓
Query 생성
 ↓
Query Hash
 ↓
Cache 확인
 ↓
있음 ─────────→ 기존 결과 사용
 ↓ 없음
API 호출
 ↓
결과 저장
 ↓
사용자에게 제공
```

단, 데이터의 최신성이 필요한 API는 TTL(Time To Live)을 적용한다.

예시:

```text
법령 데이터        짧은 TTL
병원 기본정보       1일
통계 데이터         7일
변경 가능성이 낮은 코드 30일
```

TTL은 Connector별 설정으로 관리한다.

---

# 13. UI 설계

챗봇형 UI를 기본으로 하되, 결과는 일반 채팅 텍스트만으로 표시하지 않는다.

## 권장 화면

```text
┌───────────────────────────────────────────────┐
│ Public Data AI                               │
├───────────────────────────────────────────────┤
│                                               │
│ 사용자                                         │
│ 서울에 있는 종합병원 중 응급실이 있는 곳?      │
│                                               │
│ AI                                             │
│ HIRA 데이터를 조회하고 있습니다.              │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ 검색 결과                                 │ │
│ │                                           │ │
│ │ 병원명       지역       응급실             │ │
│ │ A병원        서울       있음               │ │
│ │ B병원        서울       있음               │ │
│ │ C병원        서울       있음               │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ 데이터 출처: 건강보험심사평가원                │
│ 조회시간: 2026-08-28 11:00                    │
│                                               │
├───────────────────────────────────────────────┤
│ 질문을 입력하세요...                    [전송] │
└───────────────────────────────────────────────┘
```

## 결과 표현 방식

- 자연어 답변
- 표
- 카드
- 그래프
- JSON
- CSV
- Excel
- 원본 API 데이터
- 출처 및 조회시간

---

# 14. 권장 기술 스택

| 영역 | 추천 기술 |
|---|---|
| Desktop | Electron |
| Frontend | React + TypeScript |
| Backend/Core | TypeScript / Node.js |
| Local DB | SQLite |
| ORM | Drizzle ORM |
| Local LLM Runtime | llama.cpp |
| Model Format | GGUF |
| LLM Size | 3B~5B 우선 |
| HTTP | fetch / undici |
| Schema Validation | Zod |
| XML Parser | fast-xml-parser |
| Chart | Apache ECharts |
| Excel/CSV | SheetJS 또는 ExcelJS |
| Logging | pino |
| Test | Vitest |
| Packaging | electron-builder |
| Source License | MIT 또는 Apache 2.0 |

---

# 15. Electron 보안 구조

Renderer에서 API Key를 직접 다루지 않는다.

## 권장 구조

```text
Renderer
   ↓ IPC
Preload
   ↓
Electron Main Process
   ↓
API Connector
   ↓
HIRA / 법제처
```

API Key와 민감한 설정은 OS의 Credential 저장소 활용을 검토한다.

또한 외부 API 응답이나 사용자 입력에 민감한 정보가 포함될 가능성을 고려하여, 향후 로컬 민감정보 탐지/마스킹 계층을 추가할 수 있다.

---

# 16. 라이선스 설계

프로그램 소스의 라이선스 정책과 외부 데이터/모델의 라이선스는 분리해서 관리해야 한다.

```text
┌───────────────────────────────┐
│ 프로그램 소스                 │
│ MIT / Apache 2.0              │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Local SLM                     │
│ 해당 모델 라이선스 준수       │
└───────────────────────────────┘

┌───────────────────────────────┐
│ HIRA 데이터                   │
│ HIRA/API 이용조건 준수        │
└───────────────────────────────┘

┌───────────────────────────────┐
│ 법제처 데이터                 │
│ 국가법령정보 이용조건 준수    │
└───────────────────────────────┘
```

중요한 점은 **프로그램 소스가 MIT/Apache 2.0이라고 해서 HIRA·법제처에서 제공받는 데이터까지 동일한 라이선스로 재배포할 수 있는 것은 아니라는 것**이다.

따라서 실제 배포 전 각 API의 최신 이용약관, 출처표시, 재배포 조건을 별도로 검토해야 한다.

---

# 17. SLM 선정 및 학습 전략

## 17.1 초기 단계

처음부터 파인튜닝하지 않는다.

다음 조합으로 먼저 검증한다.

```text
Base SLM
+
System Prompt
+
Tool Schema
+
Few-shot Examples
+
JSON Schema Validation
```

## 17.2 평가 데이터셋

실제 사용 가능성을 판단하기 위해 별도의 Query 테스트셋을 만든다.

예:

```text
사용자 질문
→ 예상 Intent
→ 예상 Source
→ 예상 Tool
→ 예상 Filter
→ 예상 Query DSL
```

목표 데이터량 예:

**500~2,000건 수준의 평가 데이터셋**

을 먼저 구축하고 정확도를 측정한다.

## 17.3 파인튜닝

프롬프트 기반 성능이 부족한 경우에만 LoRA/QLoRA 등을 검토한다.

특히 다음 항목을 중심으로 학습한다.

- 한국어 자연어 이해
- API 선택
- Tool 선택
- Parameter 추출
- Query DSL 생성
- JSON 형식 준수
- 잘못된 요청 거부

---

# 18. 3~5B SLM이 적합한 이유

이 프로젝트는 일반적인 범용 LLM 서비스와 목적이 다르다.

SLM이 모든 지식을 기억할 필요가 없다.

예:

```text
일반적인 LLM 역할

질문
 ↓
모델 내부 지식
 ↓
답변
```

보다 다음 구조를 목표로 한다.

```text
질문
 ↓
SLM
 ↓
의도/조건/Tool 추출
 ↓
실제 API
 ↓
최신 데이터
 ↓
SLM
 ↓
설명
```

따라서 3B~5B급 모델에서도 충분히 실용적인 시스템을 만들 수 있다.

핵심 평가 기준은 일반 벤치마크보다 다음 항목이다.

1. 한국어 이해
2. JSON 출력 안정성
3. Tool Calling
4. Parameter Extraction
5. 지시사항 준수
6. Hallucination 억제
7. 긴 결과 데이터에 대한 처리 안정성

---

# 19. 프로젝트 폴더 구조

```text
public-data-ai/
│
├─ apps/
│  └─ desktop/
│     ├─ renderer/
│     ├─ main/
│     └─ preload/
│
├─ core/
│  ├─ llm/
│  │   ├─ inference/
│  │   ├─ prompt/
│  │   └─ schemas/
│  │
│  ├─ planner/
│  ├─ tools/
│  ├─ query/
│  │   ├─ dsl/
│  │   ├─ parser/
│  │   └─ validator/
│  │
│  ├─ cache/
│  └─ conversation/
│
├─ connectors/
│  ├─ hira/
│  │  ├─ hospital/
│  │  ├─ disease/
│  │  └─ institution/
│  │
│  └─ law/
│     ├─ search/
│     ├─ detail/
│     └─ terminology/
│
├─ data/
│  ├─ schemas/
│  └─ dictionaries/
│
├─ tests/
│  ├─ llm/
│  ├─ query/
│  ├─ connector/
│  └─ integration/
│
└─ docs/
   ├─ architecture/
   ├─ api/
   └─ license/
```

---

# 20. 확장성

초기:

```text
HIRA
법제처
```

향후:

```text
HIRA
법제처
공공데이터포털
질병관리청
식품의약품안전처
국민건강보험공단
통계청
보건복지부
```

등을 Connector로 추가할 수 있다.

API가 늘어나도 SLM의 기본 구조를 크게 변경하지 않고 Connector와 Tool을 추가하는 방식으로 확장한다.

---

# 21. Agent/Skill 구조로의 발전

향후 Tool을 Skill 단위로 묶을 수 있다.

```text
Public Data AI
│
├── HIRA Skill
│   ├── 병원 검색
│   ├── 의료기관 상세조회
│   └── 질병정보 검색
│
├── Law Skill
│   ├── 법령 검색
│   ├── 법령 본문
│   └── 법령용어 검색
│
├── Data Processing Skill
│   ├── Filter
│   ├── Sort
│   ├── Group
│   ├── Aggregate
│   └── Join
│
└── Export Skill
    ├── Excel
    ├── CSV
    └── JSON
```

이 구조는 향후 일반적인 AI Agent 구조로 확장하기에도 적합하다.

---

# 22. 복수 API 연계

최종적으로는 여러 API를 하나의 질문에서 연속적으로 사용할 수 있다.

예:

> 서울의 종합병원 중 특정 질환 진료 통계가 높은 병원을 찾아 비교해줘.

처리:

```text
사용자 질문
     ↓
SLM
     ↓
Task Planning
     ↓
┌───────────────┬───────────────┐
↓               ↓               ↓
HIRA 병원 API   HIRA 질병 API   Data Processing
↓               ↓               ↓
└───────────────┴───────────────┘
                ↓
              Join
                ↓
           Filter / Sort
                ↓
              Table
                ↓
          SLM 요약 설명
```

이 단계부터 프로그램은 단순 API 검색기를 넘어 **공공데이터 분석 Agent**로 발전한다.

---

# 23. 개발 단계

## Phase 1 — MVP

목표:

```text
Electron
+
Local SLM
+
HIRA
+
법제처
+
Chat UI
+
SQLite
```

기능:

- 자연어 질문
- API 자동 선택
- API 호출
- 결과 표시
- 대화 저장
- 대화 삭제

---

## Phase 2 — Data Assistant

추가:

- 필터
- 정렬
- 집계
- 그룹화
- 표 생성
- CSV/Excel
- 그래프
- API Response Cache
- 출처 표시

---

## Phase 3 — Agent

추가:

- 여러 API 연속 호출
- API 결과 간 Join
- 복수 조건 검색
- Tool Chaining
- Task Planning
- 자동 재시도
- 오류 복구

---

## Phase 4 — Platform

최종적으로:

```text
Public Data AI
       │
       ├── HIRA Skill
       ├── Law Skill
       ├── 질병관리청 Skill
       ├── 식약처 Skill
       ├── 통계청 Skill
       └── Custom API Skill
```

형태의 플랫폼으로 확장한다.

---

# 24. 구현 가능성 평가

| 항목 | 평가 |
|---|---:|
| Electron 구현 | ★★★★★ |
| HIRA API 연동 | ★★★★★ |
| 법제처 API 연동 | ★★★★★ |
| 3~5B SLM 활용 | ★★★★☆ |
| 자연어 → API Query | ★★★★☆ |
| 자연어 데이터 가공 | ★★★★☆ |
| 로컬 캐시 | ★★★★★ |
| Excel/CSV 출력 | ★★★★★ |
| 복수 API 결합 | ★★★★☆ |
| 향후 Agent화 | ★★★★★ |
| API 추가 확장성 | ★★★★★ |
| 완전 오프라인 | ★★☆☆☆ |
| 초기 MVP 난이도 | 중 |
| 최종 시스템 난이도 | 중~상 |

---

# 25. 핵심 리스크와 대응

| 리스크 | 대응 |
|---|---|
| SLM이 잘못된 Query 생성 | JSON Schema + Zod 검증 + 재생성 |
| 잘못된 API 선택 | Tool Registry + Intent 분류 |
| Hallucination | 실제 API 결과만 근거로 답변 |
| API 장애 | Timeout / Retry / 오류 메시지 |
| API 응답 형식 변경 | Connector별 Schema 관리 |
| API 호출량 제한 | Cache + Rate Limit |
| 법령 데이터 최신성 | TTL 단축 + 조회일 표시 |
| API Key 노출 | Main Process에서만 관리 |
| 민감정보 포함 | 로컬 필터/마스킹 계층 검토 |
| 외부 라이선스 문제 | 소스/모델/API 데이터 라이선스 분리 관리 |

---

# 26. 최종 권장 아키텍처

가장 권장하는 형태는 다음과 같다.

```text
                    ┌──────────────┐
                    │    사용자    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │  Electron UI │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Conversation │
                    │   Manager    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │   Local SLM  │
                    │    3B~5B     │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Query DSL    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Schema       │
                    │ Validator    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Tool Router  │
                    └──────┬───────┘
                           ↓
              ┌────────────┴────────────┐
              ↓                         ↓
       ┌──────────────┐          ┌──────────────┐
       │ HIRA Tool    │          │ Law Tool     │
       └──────┬───────┘          └──────┬───────┘
              ↓                         ↓
       ┌──────────────┐          ┌──────────────┐
       │ HIRA API     │          │ 법제처 API   │
       └──────┬───────┘          └──────┬───────┘
              └────────────┬────────────┘
                           ↓
                    ┌──────────────┐
                    │ Data         │
                    │ Normalizer   │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Data         │
                    │ Processor    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Result /     │
                    │ Table / Chart│
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Local SLM    │
                    │ 설명/요약    │
                    └──────┬───────┘
                           ↓
                        사용자
```

---

# 27. 결론

본 프로젝트는 기술적으로 충분히 구현 가능하며, **소형 로컬 SLM을 사용하는 것이 오히려 적합한 구조**를 만들 수 있다.

핵심은 LLM 중심 구조가 아니라 다음의 계층형 구조를 만드는 것이다.

> **자연어 → SLM → Query DSL → Tool Router → API → 구조화 데이터 → Data Processor → SLM → 사용자**

이렇게 설계하면:

- 3~5B급 로컬 모델 사용
- API 직접 호출
- 자연어 검색
- 자연어 데이터 가공
- 복수 API 연계
- 대화 및 API 캐시
- Excel/CSV 출력
- 법령 검색
- 향후 Agent/Skill 확장
- 새로운 공공 API 추가

를 하나의 구조 안에서 처리할 수 있다.

특히 **Query DSL + Tool Registry + Connector 구조**를 초기부터 제대로 설계하는 것이 장기적인 확장성을 결정하는 핵심이다.

프로젝트의 최종 방향은 단순한 "공공 API 챗봇"보다는

> **"자연어 기반 공공데이터 통합 질의·분석 Agent"**

로 정의하는 것이 적합하다.

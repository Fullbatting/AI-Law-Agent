# Connector API 레퍼런스

## HIRA — 병원정보서비스 (`connectors/hira/hospital.ts`)

- Tool 이름: `hira_hospital_search`
- 엔드포인트: `https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList`
- 인증: 공공데이터포털에서 발급받은 서비스키 (`HIRA_SERVICE_KEY` 환경변수)
- 주요 파라미터

  | 파라미터 | 설명 | 매핑 소스 |
  |---|---|---|
  | `sidoCd` | 시도코드 | `data/dictionaries/regionCodes.ts` |
  | `clCd` | 종별코드 | `data/dictionaries/hospitalTypeCodes.ts` |
  | `yadmNm` | 요양기관명 | QueryDSL `filters[field=name]` |
  | `numOfRows`, `pageNo` | 페이지네이션 | QueryDSL `limit` |

- 정규화 필드: `name, hospital_type, region, district, address, phone,
  doctor_count, established_at, emergency_room, ykiho`

## 법제처 — 법령 검색 (`connectors/law/search.ts`)

- Tool 이름: `law_search`
- 엔드포인트: `https://www.law.go.kr/DRF/lawSearch.do?target=law`
- 인증: 오픈API 신청 시 등록한 이메일 ID (`LAW_API_OC` 환경변수, 서비스키가 아님)
- 주요 파라미터

  | 파라미터 | 설명 |
  |---|---|
  | `query` | 법령명/키워드 |
  | `org` | 소관부처 |
  | `display`, `page` | 페이지네이션 |

- 정규화 필드: `law_id, name, law_type, ministry, promulgation_date,
  effective_date, detail_url`

> **주의**: 법령 원문(조문)을 함께 보여줄 때는 AI가 생성한 설명과 법령 원문을
> 명확히 분리해서 표시해야 한다 (기술기획서 7장). 이 Connector는 법령 "검색"
> 결과만 다루며, 조문 상세 조회(`law_article`)는 Phase 2에서 `law_detail.py`
> 대응 모듈로 확장할 자리로 남겨둔다.

## 공통 규약

모든 Connector는 `connectors/common/types.ts`의 `ApiConnector` 인터페이스를
구현해야 한다:

```ts
interface ApiConnector {
  name: string;
  description: string;
  source: string;
  entity: string;
  sourceLabel: string;
  buildParams(dsl: QueryDSL): ConnectorRequestParams;
  request(params: ConnectorRequestParams): Promise<unknown>;
  normalize(rawResponse: unknown): NormalizedResult;
}
```

- `buildParams`는 QueryDSL의 `filters` 중 이 API가 직접 지원하는 조건만
  파라미터로 변환한다. API가 지원하지 않는 필터(예: HIRA API에 없는
  `emergency_room` 정확 필터)는 `core/dataProcessing/pipeline.ts`가 정규화된
  데이터 위에서 다시 한번 적용하므로 Connector가 모든 필터를 처리할 필요는 없다.
- `request`는 반드시 `connectors/common/apiClient.ts`의 `ApiClient`를 통해
  호출해 재시도/타임아웃 정책을 공유한다.
- `normalize`는 원본 응답의 필드명을 내부 표준 컬럼명으로 바꾸고, 값이 없는
  필드는 `null`로 채운다.

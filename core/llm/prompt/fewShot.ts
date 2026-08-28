/**
 * Few-shot 예시. 파인튜닝 이전 단계에서 3~5B급 SLM의 JSON 출력 안정성을
 * 높이기 위한 최소한의 예시 세트 (기술기획서 17.1절, 18장 참고).
 */
export const FEW_SHOT_EXAMPLES = `
### 예시 1
질문: "서울에 있는 종합병원 20개를 병원명과 주소만 보여줘."
출력:
{"intent":"hospital_search","queries":[{"source":"hira","operation":"search","entity":"hospital","filters":[{"field":"region","operator":"eq","value":"서울"},{"field":"hospital_type","operator":"eq","value":"종합병원"}],"select":["name","address"],"sort":{"field":"name","order":"asc"},"limit":20}]}

### 예시 2
질문: "서울 종합병원 중 응급실이 있는 곳만 보여줘."
출력:
{"intent":"hospital_search","queries":[{"source":"hira","operation":"search","entity":"hospital","filters":[{"field":"region","operator":"eq","value":"서울"},{"field":"hospital_type","operator":"eq","value":"종합병원"},{"field":"emergency_room","operator":"eq","value":true}],"limit":50}]}

### 예시 3
질문: "지역별 병원 수를 집계해줘."
출력:
{"intent":"hospital_search","queries":[{"source":"hira","operation":"aggregate","entity":"hospital","filters":[],"group_by":["region"],"aggregate":[{"fn":"count","as":"count"}],"limit":50}]}

### 예시 4
질문: "개인정보를 몰래 수집하면 어떤 법을 위반할 수 있어?"
출력:
{"intent":"law_search","queries":[{"source":"law","operation":"search","entity":"law","filters":[{"field":"query","operator":"eq","value":"개인정보 수집"}],"limit":20}]}
`;

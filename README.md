# AI-Law-Agent

한국 법률 문서를 RAG 방식으로 응답하는 에이전트의 reference implementation입니다.  
**Electron 데스크톱 앱**으로 설치·실행할 수 있으며, Python FastAPI 백엔드를 함께 관리합니다.

---

## 프로젝트 구조

```
AI-Law-Agent/
├─ backend/          # Python FastAPI 백엔드 (RAG 엔진)
│  ├─ api.py         # POST /query SSE 엔드포인트
│  ├─ server.py      # 데스크톱 런처용 진입점 (/health, /index 포함)
│  ├─ indexer.py
│  ├─ retriever.py
│  ├─ llm_client.py
│  ├─ config.py
│  ├─ requirements.txt
│  └─ db_schema.sql
├─ desktop/          # Electron 데스크톱 앱
│  ├─ main.js        # 메인 프로세스 (백엔드 프로세스 관리)
│  ├─ preload.js     # contextBridge IPC
│  ├─ package.json   # electron-builder 설정 포함
│  └─ src/renderer/  # UI (HTML/CSS/JS)
│     ├─ index.html
│     └─ app.js
├─ scripts/
│  ├─ dev.sh         # 개발용 실행 스크립트
│  └─ build.sh       # 배포용 패키지 빌드 스크립트
└─ assets/           # 앱 아이콘 등
```

---

## 데스크톱 앱 실행 (개발)

### 사전 요구 사항
- Python 3.10+
- Node.js 18+
- PostgreSQL + pgvector
- Ollama 또는 외부 LLM API

### 1단계 — 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/Fullbatting/AI-Law-Agent.git
cd AI-Law-Agent
```

### 2단계 — Python 백엔드 설치

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3단계 — Electron 의존성 설치

```bash
cd ../desktop
npm install
```

### 4단계 — 앱 실행

```bash
# 루트에서 한 번에 실행 (백엔드 + Electron)
./scripts/dev.sh

# 또는 개별 실행:
# 터미널 1: 백엔드
cd backend && python server.py

# 터미널 2: Electron UI
cd desktop && npm start
```

Electron 창이 열리면 **대시보드 → 서버 시작** 버튼을 눌러 백엔드를 기동하세요.

---

## 데스크톱 앱 기능

| 탭 | 기능 |
|---|---|
| 대시보드 | 서버 시작/중지, 상태 확인 |
| 질문하기 | `/query` SSE 스트리밍 질의 응답 |
| 색인 관리 | `/index` 엔드포인트로 문서 색인 실행 |
| 설정 | DATABASE_URL, LLM_URL 등 환경 변수 편집 및 저장 |
| 로그 | 백엔드 stdout/stderr 실시간 표시 |

---

## 설치 패키지 빌드 (배포)

```bash
# Windows 인스톨러
./scripts/build.sh --win

# macOS DMG
./scripts/build.sh --mac

# Linux AppImage
./scripts/build.sh --linux
```

결과물은 `dist/` 폴더에 생성됩니다.

> **Python 번들링**: 배포 시 Python을 함께 패키징하려면 `scripts/build.sh` 내의 PyInstaller 주석 블록을 활성화하세요.

---

## 백엔드 API (직접 사용)

```bash
cd backend
python server.py          # 기본 포트 8000

# 색인
python indexer.py --source sample_legal.json

# 질의
curl -X POST http://127.0.0.1:8000/query \
     -H 'Content-Type: application/json' \
     -d '{"question":"임대차 계약 해지 조건은?"}'
```

엔드포인트:
- `POST /query` — SSE 스트리밍 응답
- `GET  /health` — 상태 확인
- `POST /index`  — 색인 실행 (SSE 스트리밍 로그)

---

## 환경 변수 (.env 또는 앱 설정)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | `postgresql://localhost:5432/legaldb` | PostgreSQL 연결 문자열 |
| `LLM_BACKEND` | `ollama` | LLM 백엔드 종류 |
| `LLM_URL` | `http://localhost:11434` | LLM 서버 URL |
| `EMBEDDING_MODEL` | `snunlp/KR-SBERT-V40K-kl` | 임베딩 모델 |
| `EMBEDDING_DIM` | `768` | 임베딩 차원 |
| `TOP_K` | `6` | 벡터 검색 상위 K |
| `BM25_K` | `10` | BM25 상위 K |
| `API_PORT` | `8000` | FastAPI 포트 |
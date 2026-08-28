@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ================================================
echo  Public Data AI - Windows 설치 스크립트
echo ================================================
echo.

rem ── 1) Node.js 설치 확인 ──────────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo        https://nodejs.org 에서 LTS 버전(20 이상)을 설치한 뒤
    echo        이 스크립트를 다시 실행하세요.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [확인] Node.js %NODE_VERSION% 감지됨.
echo.

rem ── 2) 이 배치파일이 있는 폴더(프로젝트 루트)로 이동 ──────────────────
cd /d "%~dp0"

rem ── 3) 의존성 설치 ────────────────────────────────────────────────────
echo [진행] npm install 실행 중... (인터넷 상황에 따라 수 분 소요될 수 있습니다)
call npm install
if errorlevel 1 (
    echo.
    echo [오류] npm install에 실패했습니다. 위 로그를 확인하세요.
    echo        better-sqlite3 등 네이티브 모듈 설치가 실패했다면
    echo        "Visual Studio Build Tools"(Desktop development with C++^)를
    echo        설치한 뒤 다시 시도하세요.
    pause
    exit /b 1
)
echo.

rem ── 4) 환경 변수 파일(.env) 준비 ─────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [생성] .env 파일을 .env.example로부터 생성했습니다.
        echo        HIRA_SERVICE_KEY, LAW_API_OC 값을 채워 넣어야
        echo        실제 공공데이터 API를 호출할 수 있습니다.
    )
) else (
    echo [확인] 기존 .env 파일을 그대로 사용합니다.
)
echo.

rem ── 5) 앱 빌드 (main / preload / renderer 번들) ──────────────────────
echo [진행] 앱을 빌드하는 중...
call npm run build
if errorlevel 1 (
    echo.
    echo [오류] 빌드에 실패했습니다. 위 로그를 확인하세요.
    pause
    exit /b 1
)

echo.
echo ================================================
echo  설치가 완료되었습니다!
echo.
echo  - .env 파일을 열어 API 키를 입력하세요.
echo  - run.bat 을 실행하면 프로그램이 시작됩니다.
echo ================================================
echo.
pause

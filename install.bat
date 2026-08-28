@echo off
rem 더블클릭으로 실행해도 창이 즉시 닫히지 않도록, 아직 재실행 표시(__RUN__)가
rem 없으면 새 cmd 창에서 이 스크립트를 다시 실행한다. 아래의 pause가 모든
rem 종료 경로에서 키를 기다리므로 cmd /c로도 자동 종료 전에 로그를 확인할 수 있다.
if /I not "%~1"=="__RUN__" (
    start "Public Data AI 설치" cmd /c "%~f0" __RUN__
    exit /b
)

chcp 65001 >nul
setlocal

echo ================================================
echo  Public Data AI - Windows 설치 스크립트
echo ================================================
echo.

rem 1) Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo        https://nodejs.org 에서 LTS 버전을 설치한 뒤
    echo        이 스크립트를 다시 실행하세요.
    echo.
    goto :end
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo [확인] Node.js %NODE_VERSION% 감지됨.
echo.

rem 1-1) Node 내장 sqlite 모듈 사용 가능 여부 확인 (버전 22.5 미만이면 없음)
node -e "require('node:sqlite')" >nul 2>nul
if errorlevel 1 (
    echo [오류] 현재 Node.js 버전에서는 내장 SQLite 기능을 사용할 수 없습니다.
    echo        https://nodejs.org 에서 Node.js 22.5 이상 버전을 설치한 뒤
    echo        이 스크립트를 다시 실행하세요.
    echo.
    goto :end
)

rem 2) 이 배치파일이 있는 폴더로 이동 (프로젝트 루트)
cd /d "%~dp0"

rem 3) 의존성 설치
echo [진행] npm install 실행 중... 인터넷 상황에 따라 수 분 소요될 수 있습니다.
call npm install
if errorlevel 1 (
    echo.
    echo [오류] npm install에 실패했습니다. 위 로그를 확인하세요.
    echo        네이티브 모듈 컴파일 오류라면 Visual Studio Build Tools를
    echo        설치한 뒤 다시 시도하세요. 설치 시 워크로드 목록에서
    echo        Desktop development with C++ 를 선택하세요.
    echo        https://visualstudio.microsoft.com/visual-cpp-build-tools/
    goto :end
)
echo.

rem 4) 환경 변수 파일(.env) 준비
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

rem 5) 앱 빌드 (main / preload / renderer 번들)
echo [진행] 앱을 빌드하는 중...
call npm run build
if errorlevel 1 (
    echo.
    echo [오류] 빌드에 실패했습니다. 위 로그를 확인하세요.
    goto :end
)

echo.
echo ================================================
echo  설치가 완료되었습니다!
echo.
echo  - .env 파일을 열어 API 키를 입력하세요.
echo  - run.bat 을 실행하면 프로그램이 시작됩니다.
echo ================================================

:end
echo.
echo 이 창은 아무 키나 누르면 닫힙니다.
pause >nul

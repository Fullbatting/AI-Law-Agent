@echo off
rem 더블클릭으로 실행해도 창이 즉시 닫히지 않도록, 아직 재실행 표시(__RUN__)가
rem 없으면 새 cmd 창에서 이 스크립트를 다시 실행한다. 아래의 pause가 모든
rem 종료 경로에서 키를 기다리므로 cmd /c로도 자동 종료 전에 로그를 확인할 수 있다.
if /I not "%~1"=="__RUN__" (
    start "Public Data AI" cmd /c "%~f0" __RUN__
    exit /b
)

chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
    echo [오류] node_modules 폴더가 없습니다. 먼저 install.bat 을 실행하세요.
    goto :end
)

if not exist ".env" (
    echo [경고] .env 파일이 없습니다. install.bat 을 먼저 실행하거나
    echo        .env.example 을 복사해 .env 로 만든 뒤 API 키를 채워 넣으세요.
    echo.
)

echo [진행] Public Data AI 를 시작합니다...
call npm run dev:electron
if errorlevel 1 (
    echo.
    echo [오류] 실행에 실패했습니다. dist 폴더가 비어있다면 install.bat 을
    echo        다시 실행해 빌드를 완료하세요.
    goto :end
)

:end
echo.
echo 이 창은 아무 키나 누르면 닫힙니다.
pause >nul

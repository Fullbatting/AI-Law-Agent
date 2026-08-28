@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
    echo [오류] node_modules 폴더가 없습니다. 먼저 install.bat 을 실행하세요.
    echo.
    pause
    exit /b 1
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
    pause
    exit /b 1
)

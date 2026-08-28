@echo off
chcp 65001 >nul
setlocal

rem 프로젝트 루트로 이동 (scripts\ 의 상위 폴더)
cd /d "%~dp0.."

echo ================================================
echo  Public Data AI - Windows 배포용 인스톨러 빌드
echo  (electron-builder NSIS 인스톨러를 release\ 폴더에 생성합니다)
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치하세요.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [진행] 의존성이 설치되어 있지 않아 npm install 을 먼저 실행합니다...
    call npm install
    if errorlevel 1 (
        echo [오류] npm install에 실패했습니다.
        pause
        exit /b 1
    )
)

echo [진행] npm run package:win 실행 중...
call npm run package:win
if errorlevel 1 (
    echo.
    echo [오류] 인스톨러 빌드에 실패했습니다. 위 로그를 확인하세요.
    pause
    exit /b 1
)

echo.
echo ================================================
echo  release\ 폴더에 인스톨러(.exe^)가 생성되었습니다.
echo ================================================
echo.
pause

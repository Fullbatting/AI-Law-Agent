@echo off
rem 더블클릭으로 실행해도 창이 즉시 닫히지 않도록, 아직 재실행 표시(__RUN__)가
rem 없으면 새 cmd 창에서 이 스크립트를 다시 실행한다. 아래의 pause가 모든
rem 종료 경로에서 키를 기다리므로 cmd /c로도 자동 종료 전에 로그를 확인할 수 있다.
if /I not "%~1"=="__RUN__" (
    start "Public Data AI 인스톨러 빌드" cmd /c "%~f0" __RUN__
    exit /b
)

chcp 65001 >nul
setlocal

rem 프로젝트 루트로 이동 (scripts\ 의 상위 폴더)
cd /d "%~dp0.."

echo ================================================
echo  Public Data AI - Windows 배포용 인스톨러 빌드
echo  electron-builder로 NSIS 인스톨러를 release\ 폴더에 생성합니다.
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치하세요.
    goto :end
)

if not exist "node_modules" (
    echo [진행] 의존성이 설치되어 있지 않아 npm install 을 먼저 실행합니다...
    call npm install
    if errorlevel 1 (
        echo [오류] npm install에 실패했습니다.
        goto :end
    )
)

echo [진행] npm run package:win 실행 중...
call npm run package:win
if errorlevel 1 (
    echo.
    echo [오류] 인스톨러 빌드에 실패했습니다. 위 로그를 확인하세요.
    goto :end
)

echo.
echo ================================================
echo  release\ 폴더에 인스톨러 .exe 파일이 생성되었습니다.
echo ================================================

:end
echo.
echo 이 창은 아무 키나 누르면 닫힙니다.
pause >nul

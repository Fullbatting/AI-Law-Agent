@echo off
rem Plain ASCII, English-only on purpose - see the comment at the top of
rem install.bat for why.
setlocal enabledelayedexpansion

rem Relaunch in a new console window so a double-click never closes before
rem the user can read the log.
if /I not "%~1"=="__RUN__" (
    start "Public Data AI" cmd /c "%~f0" __RUN__
    exit /b
)

cd /d "%~dp0"

if not exist "node_modules" (
    echo [ERROR] The node_modules folder is missing. Run install.bat first.
    goto :end
)

if not exist ".env" (
    echo [WARNING] No .env file found. Run install.bat first, or copy
    echo           .env.example to .env and fill in your API keys.
    echo.
)

echo Starting Public Data AI...
call npm run dev:electron
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start. If the dist folder is empty, run
    echo         install.bat again to finish building.
    goto :end
)

:end
echo.
echo Press any key to close this window.
pause >nul

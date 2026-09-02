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

rem Catch this specific, common failure before trying to launch, so the
rem error message points at the real cause (Electron's own binary failed to
rem download) instead of the generic message below, which does not apply
rem to this situation.
if not exist "node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron did not install correctly -
    echo         node_modules\electron\dist\electron.exe is missing.
    echo         This means Electron could not download its own program
    echo         during setup - it is not a bug in this app.
    echo.
    echo         Fix: run install.bat again. It will retry the Electron
    echo         download automatically. If it keeps failing, antivirus or a
    echo         company firewall/VPN is likely blocking the download -
    echo         temporarily disable it and try install.bat again.
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

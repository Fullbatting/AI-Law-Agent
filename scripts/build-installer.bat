@echo off
rem Plain ASCII, English-only on purpose - see the comment at the top of
rem install.bat for why.
setlocal enabledelayedexpansion

rem Relaunch in a new console window so a double-click never closes before
rem the user can read the log.
if /I not "%~1"=="__RUN__" (
    start "Public Data AI Installer Build" cmd /c "%~f0" __RUN__
    exit /b
)

rem Move to the project root (the parent of this scripts\ folder)
cd /d "%~dp0.."

echo ================================================
echo  Public Data AI - Windows installer build
echo  Builds a distributable NSIS installer into release\
echo  using electron-builder.
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install it from https://nodejs.org
    goto :end
)

if not exist "node_modules" (
    echo Dependencies are not installed yet, running npm install first...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        goto :end
    )
)

echo Running npm run package:win...
call npm run package:win
if errorlevel 1 (
    echo.
    echo [ERROR] Building the installer failed. See the log above.
    goto :end
)

echo.
echo ================================================
echo  The installer (.exe) was created in the release\ folder.
echo ================================================

:end
echo.
echo Press any key to close this window.
pause >nul

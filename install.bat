@echo off
rem This installer is intentionally plain ASCII, English-only. Korean text
rem combined with chcp 65001 has broken this batch file before (the
rem console codepage got misread by Windows and every word after it errored
rem out as "not recognized as an internal command"). The app itself stays
rem Korean; only these setup scripts stay ASCII so they cannot break the
rem same way again.
setlocal enabledelayedexpansion

rem Relaunch in a new console window so a double-click never closes before
rem the user can read the log. Every exit path below funnels into the
rem "pause" near the end, so cmd /c will close the window once the user
rem presses a key.
if /I not "%~1"=="__RUN__" (
    start "Public Data AI Setup" cmd /c "%~f0" __RUN__
    exit /b
)

echo ================================================
echo  Public Data AI - Windows Setup
echo ================================================
echo.

rem Best-effort cleanup: if a previous run crashed and left this app's
rem electron.exe process running in the background, it can hold files
rem locked (access denied) during npm install / build. This is scoped to
rem processes whose command line points at this project's own folder, so
rem it will not touch other Electron apps like VS Code or Slack.
where powershell >nul 2>nul
if not errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-app.ps1" -ProjectDir "%~dp0" >nul 2>nul
)

rem 1) Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo         Install it from https://nodejs.org then run this again.
    echo.
    goto :end
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo [OK] Found Node.js !NODE_VERSION!.
echo.

rem 2) Move to the folder this batch file is in (the project root)
cd /d "%~dp0"

rem 3) Install dependencies
echo [1/3] Running npm install... this can take a few minutes depending on
echo       your internet connection.
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. See the log above.
    echo         If it mentions a native module compile error, install
    echo         "Visual Studio Build Tools" with the "Desktop development
    echo         with C++" workload, then run this again.
    echo         https://visualstudio.microsoft.com/visual-cpp-build-tools/
    goto :end
)
echo.

rem 3b) Verify Electron's own binary actually downloaded. npm install can
rem report success overall while Electron's separate download step silently
rem failed (antivirus, corporate proxy/firewall, or a dropped connection are
rem the usual causes) - this is not a problem with this app's code. Retry it
rem once automatically before bothering the user: install.js is safe to
rem run again, it exits immediately if Electron is already installed.
if not exist "node_modules\electron\dist\electron.exe" (
    echo [WARNING] Electron's own binary did not download during npm install.
    echo           Retrying the Electron download...
    call node node_modules\electron\install.js
    echo.
)
if not exist "node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron still did not install correctly.
    echo         node_modules\electron\dist\electron.exe is missing. This means
    echo         Electron could not download its own program from the internet -
    echo         it is not a bug in this app.
    echo.
    echo         Common causes and fixes:
    echo           - Antivirus or a company firewall blocked the download.
    echo             Temporarily disable it, or ask your IT team to allow
    echo             github.com and githubusercontent.com.
    echo           - A VPN or proxy interrupted the connection. Try again with
    echo             it turned off.
    echo           - The download was interrupted. Delete the node_modules
    echo             folder completely and run install.bat again.
    goto :end
)
echo [OK] Electron installed correctly.
echo.

rem 4) Prepare the .env file
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [2/3] Created .env from .env.example.
        echo       Fill in HIRA_SERVICE_KEY and LAW_API_OC to call the real
        echo       public data APIs.
    )
) else (
    echo [2/3] Keeping the existing .env file.
)
echo.

rem 5) Build the app (main / preload / renderer bundles)
rem Remove any previous build output first, so a stale file from an older
rem version of this project can never end up mixed in with a fresh build.
if exist "dist" (
    rd /s /q "dist"
)
echo [3/3] Building the app...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. See the log above.
    goto :end
)

echo.
echo ================================================
echo  Setup complete!
echo.
echo  - Open .env and fill in your API keys.
echo  - Run run.bat to start the app.
echo ================================================

:end
echo.
echo Press any key to close this window.
pause >nul

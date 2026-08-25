@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI-Law-Agent  --  Windows Installer
:: ============================================================
:: This script downloads the latest packaged desktop release
:: from GitHub Releases, extracts it, and launches the app.
::
:: HOW TO UPDATE THE RELEASE ARTIFACT:
::   - Set REPO_OWNER / REPO_NAME below to match your fork.
::   - Set ASSET_NAME to the exact filename of the ZIP that is
::     uploaded to the GitHub Release (e.g. "AI-Law-Agent-win.zip").
::   - The script resolves the download URL automatically via
::     the GitHub API, so you do not need to hard-code a version.
:: ============================================================

:: --- Configuration -------------------------------------------
set "REPO_OWNER=Fullbatting"
set "REPO_NAME=AI-Law-Agent"
set "ASSET_NAME=AI-Law-Agent-win.zip"
set "INSTALL_DIR=%USERPROFILE%\AI-Law-Agent"
:: Name of the executable inside the extracted archive
set "LAUNCHER=AI-Law-Agent.exe"
:: -------------------------------------------------------------

echo.
echo  ================================================
echo   AI-Law-Agent  ^|  Windows Installer
echo  ================================================
echo.

:: 1. Ensure installation directory exists
echo [1/4] Preparing installation directory...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    if errorlevel 1 (
        echo  ERROR: Could not create "%INSTALL_DIR%". Check permissions.
        goto :fail
    )
)
echo        Install location: %INSTALL_DIR%

:: 2. Resolve the download URL of the latest release asset
echo.
echo [2/4] Resolving latest release from GitHub...
set "API_URL=https://api.github.com/repos/%REPO_OWNER%/%REPO_NAME%/releases/latest"

:: Use PowerShell to call the GitHub API and extract the download URL
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$r = Invoke-RestMethod -Uri '%API_URL%' -UseBasicParsing; ^
   $a = $r.assets | Where-Object { $_.name -eq '%ASSET_NAME%' }; ^
   if (-not $a) { Write-Error 'Asset %ASSET_NAME% not found in latest release'; exit 1 }; ^
   $a.browser_download_url | Out-File -Encoding ascii '%TEMP%\ai_law_agent_url.txt'" 2>nul

if errorlevel 1 (
    echo  ERROR: Could not retrieve release information.
    echo         Check your internet connection and that a release with
    echo         asset "%ASSET_NAME%" exists at:
    echo         https://github.com/%REPO_OWNER%/%REPO_NAME%/releases
    goto :fail
)

set /p DOWNLOAD_URL=<"%TEMP%\ai_law_agent_url.txt"
if "%DOWNLOAD_URL%"=="" (
    echo  ERROR: Download URL is empty. Aborting.
    goto :fail
)
echo        Download URL: %DOWNLOAD_URL%

:: 3. Download the release archive
echo.
echo [3/4] Downloading %ASSET_NAME%...
set "ARCHIVE=%TEMP%\%ASSET_NAME%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%ARCHIVE%' -UseBasicParsing"

if errorlevel 1 (
    echo  ERROR: Download failed. Check your internet connection.
    goto :fail
)

:: 4. Extract the archive
echo.
echo [4/4] Extracting to %INSTALL_DIR%...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Expand-Archive -Path '%ARCHIVE%' -DestinationPath '%INSTALL_DIR%' -Force"

if errorlevel 1 (
    echo  ERROR: Extraction failed.
    goto :fail
)

:: Clean up downloaded archive
del /f /q "%ARCHIVE%" >nul 2>&1
del /f /q "%TEMP%\ai_law_agent_url.txt" >nul 2>&1

:: 5. Launch the application
echo.
echo  Installation complete!
echo  Launching %LAUNCHER%...
echo.

if exist "%INSTALL_DIR%\%LAUNCHER%" (
    start "" "%INSTALL_DIR%\%LAUNCHER%"
) else (
    :: Some builds place the exe inside a sub-folder with the same base name
    for /r "%INSTALL_DIR%" %%F in (%LAUNCHER%) do (
        start "" "%%F"
        goto :done
    )
    echo  WARNING: Could not find %LAUNCHER% in %INSTALL_DIR%.
    echo           Please open that folder and run the application manually.
    explorer "%INSTALL_DIR%"
)

:done
echo.
echo  Done. Enjoy AI-Law-Agent!
echo.
pause
endlocal
exit /b 0

:fail
echo.
echo  Setup did not complete successfully.
echo  Please check the error message above and try again.
echo.
pause
endlocal
exit /b 1

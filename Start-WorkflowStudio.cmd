@echo off
setlocal
set "studioNode="
if exist "%~dp0..\.tools\node-v24.22.1-win-x64\node.exe" set "studioNode=%~dp0..\.tools\node-v24.22.1-win-x64\node.exe"
if defined WORKFLOW_STUDIO_NODE if exist "%WORKFLOW_STUDIO_NODE%" set "studioNode=%WORKFLOW_STUDIO_NODE%"
if not defined studioNode if exist "%~dp0.local\node-path.txt" set /p studioNode=<"%~dp0.local\node-path.txt"
if not defined studioNode for %%P in (node.exe) do set "studioNode=%%~$PATH:P"
if not defined studioNode (
  echo Node 24 wurde nicht gefunden. Die lokale Build-Laufzeit oder Node 24 wird benoetigt.
  pause
  exit /b 1
)
"%studioNode%" "%~dp0scripts\start-studio.mjs" %*
set "studioExit=%errorlevel%"
if not "%studioExit%"=="0" (
  echo.
  echo Studio konnte nicht gestartet werden. Fehlermeldung oben beachten.
  pause
)
exit /b %studioExit%

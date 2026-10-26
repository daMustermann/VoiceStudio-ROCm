@echo off
setlocal
cd /d "%~dp0"

rem Run the built desktop app directly: no Vite watcher or separate API daemon.
rem Electron owns the Python backend and stops its process tree on window close.
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_RENDERER_URL="

where bun >nul 2>&1
if errorlevel 1 (
  echo Bun is not installed or not on PATH.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo The VoiceStudio Python environment is missing. Run the ROCm setup first.
  pause
  exit /b 1
)

if not exist "electron\node_modules\electron\dist\electron.exe" (
  echo Electron is missing. Run bun install first.
  pause
  exit /b 1
)

echo Building VoiceStudio ROCm...
call bun run build
if errorlevel 1 (
  echo Build failed. VoiceStudio was not started.
  pause
  exit /b 1
)

echo Starting VoiceStudio ROCm...
start "" /wait "%CD%\electron\node_modules\electron\dist\electron.exe" "%CD%\electron"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo VoiceStudio exited with code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%

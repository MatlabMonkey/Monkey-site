@echo off
echo 🚀 Todo Script Setup
echo.

REM Create the tools directory
set TOOLS_DIR=C:\Tools\TodoScript
if not exist "%TOOLS_DIR%" (
    echo Creating directory: %TOOLS_DIR%
    mkdir "%TOOLS_DIR%"
)

echo ✅ Tools directory ready: %TOOLS_DIR%
echo.

REM Instructions
echo 📋 Setup Instructions:
echo.
echo 1. Copy these files to %TOOLS_DIR%:
echo    - add-todo.py
echo    - todo-gui.py
echo    - Add-Todo.ps1
echo.
echo 2. Set environment variables (recommended):
echo    - TODO_API_URL (optional; defaults to https://ztbrown.com/api/webhook/todos)
echo    - TODO_WEBHOOK_SECRET (or WEBHOOK_SECRET / CAPTURE_API_KEY)
echo.
echo 3. Add %TOOLS_DIR% to your Windows PATH:
echo    - Press Win+R, type: sysdm.cpl
echo    - Go to Advanced → Environment Variables
echo    - Edit PATH and add: %TOOLS_DIR%
echo.
echo 4. Copy todo.bat to %TOOLS_DIR%
echo.
echo 5. Test by pressing Win+R and typing: todo "Test item"
echo.

pause

@echo off
setlocal enabledelayedexpansion

REM Quick Todo Adder Batch Script
REM Usage: todo "Your todo item here"

REM Configuration - UPDATE THIS PATH
set SCRIPT_DIR=C:\Tools\TodoScript
set PYTHON_SCRIPT=%SCRIPT_DIR%\add-todo.py

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if script exists
if not exist "%PYTHON_SCRIPT%" (
    echo ❌ Error: Todo script not found at %PYTHON_SCRIPT%
    echo Please make sure the script is installed correctly
    pause
    exit /b 1
)

REM If no arguments provided, prompt for input
if "%~1"=="" (
    echo 🚀 Quick Todo Adder
    echo.
    set /p "todo_input=Enter your todo: "
    if "!todo_input!"=="" (
        echo ❌ No todo entered. Exiting...
        pause
        exit /b 1
    )
    python "%PYTHON_SCRIPT%" "!todo_input!"
) else (
    REM Use provided arguments
    python "%PYTHON_SCRIPT%" %*
)

exit /b 0

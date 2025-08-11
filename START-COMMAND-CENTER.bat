@echo off
title Command Center Launcher
color 0A

echo ============================================
echo Starting Unit Talk Command Center
echo ============================================
echo.

REM Run the PowerShell script for Command Center only
powershell -ExecutionPolicy Bypass -File "%~dp0launch-all-apps.ps1" -App command-center

pause
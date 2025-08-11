@echo off
title API Launcher
color 0A

echo ============================================
echo Starting Unit Talk API
echo ============================================
echo.

REM Run the PowerShell script for API only
powershell -ExecutionPolicy Bypass -File "%~dp0launch-all-apps.ps1" -App api

pause
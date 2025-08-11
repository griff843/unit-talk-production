@echo off
title Dashboard Launcher
color 0A

echo ============================================
echo Starting Unit Talk Analytics Dashboard
echo ============================================
echo.

REM Run the PowerShell script for Dashboard only
powershell -ExecutionPolicy Bypass -File "%~dp0launch-all-apps.ps1" -App dashboard

pause
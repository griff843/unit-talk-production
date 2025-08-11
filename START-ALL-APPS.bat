@echo off
title Unit Talk Platform Launcher
color 0A

echo ============================================
echo Unit Talk Platform - Starting All Apps
echo ============================================
echo.

REM Run the PowerShell script with execution policy bypass
powershell -ExecutionPolicy Bypass -File "%~dp0launch-all-apps.ps1" -App all

pause
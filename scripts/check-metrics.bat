@echo off
REM Unit Talk Platform - Metrics Check Script (Windows)
REM Checks if Prometheus metrics endpoint is reachable

setlocal enabledelayedexpansion

REM Set default values
set "ENVIRONMENT=%1"
if "%ENVIRONMENT%"=="" set "ENVIRONMENT=staging"

set "API_HOST=%API_HOST%"
if "%API_HOST%"=="" set "API_HOST=localhost"

set "API_METRICS_PORT=%API_METRICS_PORT%"
if "%API_METRICS_PORT%"=="" set "API_METRICS_PORT=9464"

echo [%time%] Checking Prometheus metrics endpoint (%ENVIRONMENT%)...

REM Check if curl is available
curl --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: curl is not installed or not in PATH
    echo Please install curl or use PowerShell alternative
    exit /b 1
)

REM Test metrics endpoint
curl -fsS "http://%API_HOST%:%API_METRICS_PORT%/metrics" | findstr /c:"# TYPE" >nul
if errorlevel 1 (
    echo ERROR: Metrics endpoint not reachable
    exit /b 1
) else (
    echo OK: Metrics endpoint reachable
    exit /b 0
)
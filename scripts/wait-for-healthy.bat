@echo off
REM Unit Talk Platform - Wait for Healthy Script (Windows)
REM Waits for API health check to pass

setlocal enabledelayedexpansion

REM Set default values
set "API_URL=%API_URL%"
if "%API_URL%"=="" set "API_URL=http://localhost:3000/health"

set "TIMEOUT=%TIMEOUT%"
if "%TIMEOUT%"=="" set "TIMEOUT=120"

set "SLEEP=%SLEEP%"
if "%SLEEP%"=="" set "SLEEP=5"

set /a elapsed=0

echo [%time%] Waiting for health: %API_URL% (timeout=%TIMEOUT%s)

REM Check if curl is available
curl --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: curl is not installed or not in PATH
    echo Please install curl or use PowerShell alternative
    exit /b 1
)

:healthcheck_loop
if %elapsed% geq %TIMEOUT% (
    echo ERROR: Service did not become healthy in %TIMEOUT%s
    exit /b 1
)

REM Test health endpoint
curl -fsS "%API_URL%" >nul 2>&1
if not errorlevel 1 (
    echo OK: Service healthy
    exit /b 0
)

timeout /t %SLEEP% /nobreak >nul
set /a elapsed+=%SLEEP%
echo ... still waiting (%elapsed%s)
goto healthcheck_loop
@echo off
REM Unit Talk Platform - Rollback Script (Windows)
REM Performs rollback of Docker Compose services

setlocal enabledelayedexpansion

REM Set default values
set "ENVIRONMENT=%1"
if "%ENVIRONMENT%"=="" set "ENVIRONMENT=production"

set "SERVICE=%2"
if "%SERVICE%"=="" set "SERVICE=all"

set "VERSION=%3"
if "%VERSION%"=="" set "VERSION=previous"

echo ===========================================
echo Unit Talk Platform - Rollback Script
echo Environment: %ENVIRONMENT%
echo Service: %SERVICE%
echo Target Version: %VERSION%
echo ===========================================

REM Check if Docker Compose is available
docker-compose version >nul 2>&1
if errorlevel 1 (
    echo ERROR: docker-compose is not installed or not in PATH
    exit /b 1
)

echo 🚨 Initiating rollback procedure...

REM Create backup directory
set "timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "timestamp=%timestamp: =0%"
set "backup_dir=.\backups\rollback_%timestamp%"

echo 💾 Creating rollback backup...
if not exist ".\backups" mkdir ".\backups"
mkdir "%backup_dir%"

REM Backup current configuration
copy "docker-compose.yml" "%backup_dir%\" >nul
copy ".env" "%backup_dir%\" >nul

REM Backup database if running
docker ps | findstr "unit-talk-postgres" >nul
if not errorlevel 1 (
    echo Backing up database...
    docker exec unit-talk-postgres pg_dump -U postgres unit_talk_dev > "%backup_dir%\database_backup.sql"
)

echo Backup created at: %backup_dir%

REM Perform rollback based on environment
echo 🔄 Rolling back Docker Compose services...

if "%ENVIRONMENT%"=="development" goto dev_rollback
if "%ENVIRONMENT%"=="dev" goto dev_rollback
if "%ENVIRONMENT%"=="staging" goto staging_rollback  
if "%ENVIRONMENT%"=="stage" goto staging_rollback
if "%ENVIRONMENT%"=="production" goto prod_rollback
if "%ENVIRONMENT%"=="prod" goto prod_rollback

echo ❌ Unknown environment: %ENVIRONMENT%
exit /b 1

:dev_rollback
echo Development rollback - using Docker Compose
goto standard_rollback

:staging_rollback
echo Staging rollback - using Docker Compose with staging config
if exist "docker-compose.staging.yml" (
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml down
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
) else (
    goto standard_rollback
)
goto verify_rollback

:prod_rollback
echo Production rollback - using Docker Compose
echo ⚠️  This should integrate with your K8s/Helm/Argo deployment system
goto standard_rollback

:standard_rollback
if "%SERVICE%"=="all" (
    echo Rolling back all services...
    docker-compose down
    if exist "docker-compose.%VERSION%.yml" (
        echo Using docker-compose.%VERSION%.yml
        copy "docker-compose.%VERSION%.yml" "docker-compose.yml" >nul
    )
    docker-compose up -d
) else (
    echo Rolling back service: %SERVICE%
    docker-compose stop %SERVICE%
    if not "%VERSION%"=="previous" (
        docker-compose pull %SERVICE%:%VERSION%
    )
    docker-compose up -d %SERVICE%
)

:verify_rollback
echo 🔍 Verifying rollback success...

set /a timeout=120
set /a elapsed=0

:verify_loop
if %elapsed% geq %timeout% (
    echo ❌ Rollback verification failed - API not healthy after %timeout%s
    echo 📢 Notification: Rollback FAILED for %ENVIRONMENT% environment
    exit /b 1
)

REM Check API health
curl -fsS "http://localhost:3000/health" >nul 2>&1
if not errorlevel 1 (
    echo ✅ Rollback verification successful - API is healthy
    echo 📢 Notification: Rollback COMPLETED for %ENVIRONMENT% environment
    echo ✅ Rollback completed successfully!
    exit /b 0
)

timeout /t 5 /nobreak >nul
set /a elapsed+=5
echo ... waiting for API health check (%elapsed%s)
goto verify_loop
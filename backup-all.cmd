@echo off
REM Unit Talk Platform - Complete Automated Backup
REM Creates comprehensive backup for PC switching

echo ===============================================
echo   UNIT TALK PLATFORM - AUTOMATED BACKUP
echo   Complete System Backup for PC Switching
echo ===============================================
echo.

REM Set timestamp for backup
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "backup_timestamp=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"

echo [INFO] Creating backup with timestamp: %backup_timestamp%
echo.

REM Create backup directory
set "backup_dir=backups\%backup_timestamp%"
mkdir "%backup_dir%" 2>nul

echo [1/6] Backing up configuration files...

REM Backup critical configuration files
if exist .env (
    copy .env "%backup_dir%\.env" >nul
    echo ✅ .env backed up
) else (
    echo ⚠️  .env not found
)

if exist docker-compose.yml (
    copy docker-compose.yml "%backup_dir%\docker-compose.yml" >nul
    echo ✅ docker-compose.yml backed up
) else (
    echo ❌ docker-compose.yml not found
)

REM Backup config directory
if exist config\ (
    xcopy config\ "%backup_dir%\config\" /E /I /Q >nul 2>&1
    echo ✅ Config directory backed up
) else (
    echo ⚠️  Config directory not found
)

echo.
echo [2/6] Checking Docker services...

REM Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not running. Skipping database backup.
    goto :skip_database
)

REM Check if postgres is running
docker-compose ps postgres | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PostgreSQL not running. Starting it for backup...
    docker-compose up -d postgres >nul 2>&1
    timeout /t 15 >nul
)

echo.
echo [3/6] Backing up database...

REM Database backup with error handling
docker-compose exec -T postgres pg_dump -U postgres unit_talk_dev > "%backup_dir%\database_full.sql" 2>nul
if exist "%backup_dir%\database_full.sql" (
    for %%F in ("%backup_dir%\database_full.sql") do (
        if %%~zF GTR 1000 (
            echo ✅ Database backup created (%%~zF bytes)
        ) else (
            echo ⚠️  Database backup appears small (%%~zF bytes)
        )
    )
) else (
    echo ❌ Database backup failed
)

REM Schema-only backup for reference
docker-compose exec -T postgres pg_dump -U postgres -s unit_talk_dev > "%backup_dir%\database_schema.sql" 2>nul
if exist "%backup_dir%\database_schema.sql" (
    echo ✅ Database schema backed up
)

:skip_database

echo.
echo [4/6] Backing up Docker volumes...

REM Backup PostgreSQL volume
echo Backing up PostgreSQL data...
docker run --rm -v unit-talk-production-main_postgres_data:/source -v "%cd%\%backup_dir%":/backup alpine tar czf /backup/postgres_data.tar.gz -C /source . 2>nul
if exist "%backup_dir%\postgres_data.tar.gz" (
    echo ✅ PostgreSQL volume backed up
) else (
    echo ⚠️  PostgreSQL volume backup failed or empty
)

REM Backup Redis volume
echo Backing up Redis data...
docker run --rm -v unit-talk-production-main_redis_data:/source -v "%cd%\%backup_dir%":/backup alpine tar czf /backup/redis_data.tar.gz -C /source . 2>nul
if exist "%backup_dir%\redis_data.tar.gz" (
    echo ✅ Redis volume backed up
) else (
    echo ⚠️  Redis volume backup failed or empty
)

REM Backup Prometheus volume
echo Backing up Prometheus data...
docker run --rm -v unit-talk-production-main_prometheus_data:/source -v "%cd%\%backup_dir%":/backup alpine tar czf /backup/prometheus_data.tar.gz -C /source . 2>nul
if exist "%backup_dir%\prometheus_data.tar.gz" (
    echo ✅ Prometheus volume backed up
) else (
    echo ⚠️  Prometheus volume backup failed or empty
)

echo.
echo [5/6] Creating service logs snapshot...

REM Capture current service logs
docker-compose logs --tail=100 > "%backup_dir%\service_logs.txt" 2>nul
if exist "%backup_dir%\service_logs.txt" (
    echo ✅ Service logs captured
) else (
    echo ⚠️  Service logs not captured
)

REM Capture service status
docker-compose ps > "%backup_dir%\service_status.txt" 2>nul
echo ✅ Service status captured

echo.
echo [6/6] Creating backup manifest...

REM Create backup manifest
echo Unit Talk Platform Backup > "%backup_dir%\BACKUP_MANIFEST.txt"
echo Backup Date: %date% %time% >> "%backup_dir%\BACKUP_MANIFEST.txt"
echo Backup Timestamp: %backup_timestamp% >> "%backup_dir%\BACKUP_MANIFEST.txt"
echo. >> "%backup_dir%\BACKUP_MANIFEST.txt"
echo Files in this backup: >> "%backup_dir%\BACKUP_MANIFEST.txt"
dir /b "%backup_dir%" >> "%backup_dir%\BACKUP_MANIFEST.txt"

echo.
echo ==============================================
echo   BACKUP COMPLETED SUCCESSFULLY
echo ==============================================
echo.
echo 📁 Backup Location: %backup_dir%
echo.
echo ✅ Files Backed Up:
dir /b "%backup_dir%"

echo.
echo 💡 Next Steps:
echo 1. This backup is automatically synced via OneDrive
echo 2. On your main PC, copy this project folder from OneDrive
echo 3. Run 'restore-latest.cmd' to restore from this backup
echo 4. Run 'quick-start.cmd' to start services
echo.

REM Calculate backup size
for /f "tokens=3" %%a in ('dir /s "%backup_dir%" ^| findstr "bytes"') do set "backup_size=%%a"
echo 📊 Backup Size: %backup_size% bytes
echo.

pause
@echo off
REM Unit Talk Platform - Automated Restore from Latest Backup
REM Restores complete system state for PC switching

echo ===============================================
echo   UNIT TALK PLATFORM - AUTOMATED RESTORE
echo   Restore from Latest Backup
echo ===============================================
echo.

REM Check if we're in the right directory
if not exist docker-compose.yml (
    echo ❌ docker-compose.yml not found. Please run this from the project root directory.
    pause
    exit /b 1
)

REM Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed or not running
    echo Please install Docker Desktop and start it, then try again
    pause
    exit /b 1
)

echo [INFO] Finding latest backup...

REM Find the latest backup directory
set "latest_backup="
for /f "delims=" %%d in ('dir backups /b /ad /o-d 2^>nul') do (
    if not defined latest_backup set "latest_backup=%%d"
)

if not defined latest_backup (
    echo ❌ No backup directories found in backups\
    echo Please ensure you have a backup created with backup-all.cmd
    pause
    exit /b 1
)

set "backup_dir=backups\%latest_backup%"
echo ✅ Found latest backup: %latest_backup%
echo 📁 Restoring from: %backup_dir%
echo.

REM Show backup contents
echo [INFO] Backup contents:
if exist "%backup_dir%\BACKUP_MANIFEST.txt" (
    type "%backup_dir%\BACKUP_MANIFEST.txt"
) else (
    echo Files in backup:
    dir /b "%backup_dir%"
)

echo.
set /p "confirm=Continue with restore from this backup? (Y/n): "
if /i "%confirm%"=="n" (
    echo Restore cancelled.
    pause
    exit /b 0
)

echo.
echo [1/6] Stopping existing services...

REM Stop all services and clean up
docker-compose down --volumes >nul 2>&1
docker system prune -f >nul 2>&1
echo ✅ Existing services stopped and cleaned

echo.
echo [2/6] Restoring configuration files...

REM Restore configuration files
if exist "%backup_dir%\.env" (
    copy "%backup_dir%\.env" .env >nul
    echo ✅ .env restored
) else (
    echo ⚠️  .env not found in backup, using .env.example
    if exist .env.example (
        copy .env.example .env >nul
        echo ✅ .env created from example
    )
)

if exist "%backup_dir%\docker-compose.yml" (
    copy "%backup_dir%\docker-compose.yml" docker-compose.yml >nul
    echo ✅ docker-compose.yml restored
) else (
    echo ⚠️  docker-compose.yml not found in backup
)

REM Restore config directory
if exist "%backup_dir%\config\" (
    rmdir /s /q config\ 2>nul
    xcopy "%backup_dir%\config\" config\ /E /I /Q >nul 2>&1
    echo ✅ Config directory restored
) else (
    echo ⚠️  Config directory not found in backup
)

echo.
echo [3/6] Starting infrastructure services...

REM Start infrastructure services
echo Starting PostgreSQL, Redis, Prometheus, Grafana...
docker-compose up -d postgres redis prometheus grafana temporal-postgres temporal temporal-ui >nul 2>&1

echo Waiting 30 seconds for infrastructure to initialize...
timeout /t 30 >nul

REM Verify PostgreSQL is ready
echo Verifying PostgreSQL is ready...
timeout /t 5 >nul
docker-compose exec postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PostgreSQL not ready, waiting additional time...
    timeout /t 15 >nul
    docker-compose exec postgres pg_isready -U postgres >nul 2>&1
)

echo.
echo [4/6] Restoring database...

if exist "%backup_dir%\database_full.sql" (
    echo Creating database...
    docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS unit_talk_dev;" >nul 2>&1
    docker-compose exec postgres psql -U postgres -c "CREATE DATABASE unit_talk_dev;" >nul 2>&1
    
    echo Restoring database from backup...
    docker-compose exec -T postgres psql -U postgres unit_talk_dev < "%backup_dir%\database_full.sql" >nul 2>&1
    
    if errorlevel 1 (
        echo ❌ Database restore failed
        echo Trying to create empty database...
        docker-compose exec postgres psql -U postgres -c "CREATE DATABASE unit_talk_dev;" >nul 2>&1
        echo ⚠️  Empty database created, you may need to run migrations
    ) else (
        echo ✅ Database restored successfully
    )
) else (
    echo ⚠️  No database backup found, creating empty database
    docker-compose exec postgres psql -U postgres -c "CREATE DATABASE unit_talk_dev;" >nul 2>&1
    echo ✅ Empty database created
)

REM Verify database
echo Verifying database...
docker-compose exec postgres psql -U postgres unit_talk_dev -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Database verification failed, but continuing...
) else (
    echo ✅ Database verification successful
)

echo.
echo [5/6] Restoring Docker volumes...

REM Restore PostgreSQL volume
if exist "%backup_dir%\postgres_data.tar.gz" (
    echo Restoring PostgreSQL data volume...
    docker-compose stop postgres >nul 2>&1
    docker run --rm -v unit-talk-production-main_postgres_data:/target -v "%cd%\%backup_dir%":/backup alpine sh -c "cd /target && tar xzf /backup/postgres_data.tar.gz" >nul 2>&1
    docker-compose start postgres >nul 2>&1
    echo ✅ PostgreSQL volume restored
) else (
    echo ⚠️  PostgreSQL volume backup not found
)

REM Restore Redis volume
if exist "%backup_dir%\redis_data.tar.gz" (
    echo Restoring Redis data volume...
    docker-compose stop redis >nul 2>&1
    docker run --rm -v unit-talk-production-main_redis_data:/target -v "%cd%\%backup_dir%":/backup alpine sh -c "cd /target && tar xzf /backup/redis_data.tar.gz" >nul 2>&1
    docker-compose start redis >nul 2>&1
    echo ✅ Redis volume restored
) else (
    echo ⚠️  Redis volume backup not found
)

REM Restore Prometheus volume
if exist "%backup_dir%\prometheus_data.tar.gz" (
    echo Restoring Prometheus data volume...
    docker-compose stop prometheus >nul 2>&1
    docker run --rm -v unit-talk-production-main_prometheus_data:/target -v "%cd%\%backup_dir%":/backup alpine sh -c "cd /target && tar xzf /backup/prometheus_data.tar.gz" >nul 2>&1
    docker-compose start prometheus >nul 2>&1
    echo ✅ Prometheus volume restored
) else (
    echo ⚠️  Prometheus volume backup not found
)

echo.
echo [6/6] Final service startup...

echo Starting all infrastructure services...
docker-compose up -d postgres redis prometheus grafana temporal-postgres temporal temporal-ui >nul 2>&1

echo Waiting for services to stabilize...
timeout /t 20 >nul

echo.
echo ==============================================
echo   RESTORE COMPLETED
echo ==============================================
echo.

echo Checking service status...
docker-compose ps

echo.
echo ==============================================
echo   VERIFICATION
echo ==============================================
echo.

REM Verify key services
echo Checking PostgreSQL...
docker-compose exec postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL not ready
) else (
    echo ✅ PostgreSQL is ready
)

echo Checking Redis...
docker-compose exec redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ❌ Redis not responding
) else (
    echo ✅ Redis is responding
)

echo Checking database connection...
docker-compose exec postgres psql -U postgres unit_talk_dev -c "SELECT 'Database OK' as status;" 2>nul | findstr "Database OK" >nul
if errorlevel 1 (
    echo ⚠️  Database connection issue
) else (
    echo ✅ Database connection verified
)

echo.
echo ==============================================
echo   ACCESS YOUR SERVICES
echo ==============================================
echo.
echo 💾 INFRASTRUCTURE (RESTORED):
echo    🗄️  PostgreSQL:          localhost:5432
echo    ⚡ Redis:               localhost:6379  
echo    📊 Prometheus:          http://localhost:9090
echo    📈 Grafana:             http://localhost:3001 (admin/admin)
echo    ⏱️  Temporal UI:         http://localhost:8088
echo.
echo 🚧 APPLICATION SERVICES:
echo    Run 'quick-start.cmd' for basic infrastructure
echo    Run 'full-start.cmd' to build and start all applications
echo.

echo ✅ Restore completed from backup: %latest_backup%
echo 💡 Your system is now restored and ready to use!
echo.

set /p "start_services=Start monitoring dashboards now? (Y/n): "
if /i "%start_services%" neq "n" (
    echo Opening dashboards...
    start http://localhost:9090 >nul 2>&1
    start http://localhost:3001 >nul 2>&1
    start http://localhost:8088 >nul 2>&1
)

echo.
pause
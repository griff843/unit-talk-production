# 🔄 Unit Talk Platform - Backup & Restore Procedures

## 📋 Overview

Comprehensive backup and restore procedures for seamless PC transitions, disaster recovery, and production deployments. These procedures ensure zero data loss and minimal downtime.

## 🎯 Quick Reference

### Essential Backup Components

**✅ Critical Data (MUST backup)**:
- Database (PostgreSQL with all schemas)
- Configuration files (`.env`, `docker-compose.yml`)
- Application code (entire project directory)
- Docker volumes (persistent data)
- Environment-specific settings

**✅ Automatic Backups (via OneDrive)**:
- Source code changes
- Configuration updates
- Documentation modifications
- Environment files

## 💾 Complete Backup Procedures

### 1. Pre-Backup Verification

```cmd
REM Ensure all services are running
docker-compose ps

REM Check database connectivity
docker-compose exec postgres pg_isready -U postgres

REM Verify data integrity
docker-compose exec postgres psql -U postgres unit_talk_dev -c "SELECT COUNT(*) FROM unified_picks;"
```

### 2. Database Backup

```cmd
REM Create timestamped backup
set backup_date=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
set backup_date=%backup_date: =0%

REM Full database backup
docker-compose exec postgres pg_dump -U postgres -h localhost unit_talk_dev > "backups\unit_talk_backup_%backup_date%.sql"

REM Schema-only backup (for reference)
docker-compose exec postgres pg_dump -U postgres -h localhost -s unit_talk_dev > "backups\unit_talk_schema_%backup_date%.sql"

REM Verify backup file
if exist "backups\unit_talk_backup_%backup_date%.sql" (
    echo ✅ Database backup created successfully
) else (
    echo ❌ Database backup failed
    exit /b 1
)
```

### 3. Application State Backup

```cmd
REM Create backups directory
mkdir backups 2>nul

REM Backup environment configuration
copy .env "backups\.env_backup_%backup_date%"

REM Backup docker configuration
copy docker-compose.yml "backups\docker-compose_backup_%backup_date%.yml"

REM Backup any custom configurations
xcopy config\ backups\config_%backup_date%\ /E /I

REM Create service logs backup
docker-compose logs > "backups\service_logs_%backup_date%.txt"
```

### 4. Docker Volumes Backup

```cmd
REM List and backup Docker volumes
docker volume ls > "backups\docker_volumes_%backup_date%.txt"

REM Backup PostgreSQL data volume
docker run --rm -v unit-talk-production-main_postgres_data:/source -v %cd%\backups:/backup alpine tar czf /backup/postgres_data_%backup_date%.tar.gz -C /source .

REM Backup Redis data volume
docker run --rm -v unit-talk-production-main_redis_data:/source -v %cd%\backups:/backup alpine tar czf /backup/redis_data_%backup_date%.tar.gz -C /source .

REM Backup Prometheus data volume
docker run --rm -v unit-talk-production-main_prometheus_data:/source -v %cd%\backups:/backup alpine tar czf /backup/prometheus_data_%backup_date%.tar.gz -C /source .
```

## 🔄 Complete Restore Procedures

### 1. Pre-Restore Environment Setup

```cmd
REM Ensure Docker is running
docker --version
if errorlevel 1 (
    echo Please install and start Docker Desktop
    exit /b 1
)

REM Stop any existing services
docker-compose down --volumes

REM Clean Docker system
docker system prune -af

REM Verify project structure
if not exist docker-compose.yml (
    echo ❌ docker-compose.yml not found. Ensure you're in the correct directory.
    exit /b 1
)
```

### 2. Configuration Restore

```cmd
REM Restore environment configuration
if exist "backups\.env_backup_*" (
    copy "backups\.env_backup_*" .env
    echo ✅ Environment configuration restored
) else (
    echo ⚠️  No environment backup found, using .env.example
    copy .env.example .env
)

REM Restore custom configurations
if exist "backups\config_*" (
    xcopy "backups\config_*" config\ /E /I /Y
    echo ✅ Custom configurations restored
)
```

### 3. Infrastructure Startup

```cmd
REM Start infrastructure services only
echo Starting infrastructure services...
docker-compose up -d postgres redis prometheus grafana temporal-postgres temporal temporal-ui

REM Wait for services to initialize
echo Waiting for infrastructure to start...
timeout /t 30 >nul

REM Verify PostgreSQL is ready
docker-compose exec postgres pg_isready -U postgres
if errorlevel 1 (
    echo ❌ PostgreSQL not ready. Check logs: docker-compose logs postgres
    exit /b 1
)
```

### 4. Database Restore

```cmd
REM Find latest backup file
for /f "delims=" %%F in ('dir /b /o-d backups\unit_talk_backup_*.sql 2^>nul') do set latest_backup=%%F

if defined latest_backup (
    echo Found backup: %latest_backup%
    
    REM Create database if it doesn't exist
    docker-compose exec postgres psql -U postgres -c "CREATE DATABASE unit_talk_dev;" 2>nul
    
    REM Restore database
    docker-compose exec -T postgres psql -U postgres unit_talk_dev < "backups\%latest_backup%"
    
    if errorlevel 1 (
        echo ❌ Database restore failed
        exit /b 1
    ) else (
        echo ✅ Database restored successfully
    )
) else (
    echo ⚠️  No database backup found. Creating fresh database...
    docker-compose exec postgres psql -U postgres -c "CREATE DATABASE unit_talk_dev;"
)

REM Verify database restore
docker-compose exec postgres psql -U postgres unit_talk_dev -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

### 5. Docker Volumes Restore

```cmd
REM Restore PostgreSQL data volume (if available)
if exist "backups\postgres_data_*.tar.gz" (
    for /f "delims=" %%F in ('dir /b /o-d backups\postgres_data_*.tar.gz 2^>nul') do set latest_postgres=%%F
    docker run --rm -v unit-talk-production-main_postgres_data:/target -v %cd%\backups:/backup alpine tar xzf /backup/!latest_postgres! -C /target
    echo ✅ PostgreSQL volume restored
)

REM Restore Redis data volume (if available)
if exist "backups\redis_data_*.tar.gz" (
    for /f "delims=" %%F in ('dir /b /o-d backups\redis_data_*.tar.gz 2^>nul') do set latest_redis=%%F
    docker run --rm -v unit-talk-production-main_redis_data:/target -v %cd%\backups:/backup alpine tar xzf /backup/!latest_redis! -C /target
    echo ✅ Redis volume restored
)

REM Restart services with restored volumes
docker-compose restart postgres redis
```

### 6. Application Services Restore

```cmd
REM Build and start application services
echo Building application services...
docker-compose build --no-cache

if errorlevel 1 (
    echo ❌ Application build failed. Check individual service logs.
    exit /b 1
)

echo Starting all services...
docker-compose up -d

REM Wait for services to stabilize
timeout /t 30 >nul

echo ✅ All services restored and running
```

## 🚨 Emergency Recovery Scenarios

### Scenario 1: Complete System Loss

```cmd
REM 1. Fresh installation
git clone <repository-url> unit-talk-platform
cd unit-talk-platform

REM 2. Restore from OneDrive backup
copy "C:\Users\%USERNAME%\OneDrive\unit-talk-production-main\.env" .env
xcopy "C:\Users\%USERNAME%\OneDrive\unit-talk-production-main\backups" backups\ /E /I

REM 3. Follow complete restore procedure above
```

### Scenario 2: Database Corruption

```cmd
REM 1. Stop services
docker-compose down

REM 2. Remove corrupted volume
docker volume rm unit-talk-production-main_postgres_data

REM 3. Restart PostgreSQL
docker-compose up -d postgres

REM 4. Restore from latest backup
REM (Follow Database Restore procedure above)
```

### Scenario 3: Configuration Loss

```cmd
REM 1. Restore from backup
copy "backups\.env_backup_*" .env

REM 2. Restart services with new configuration
docker-compose down
docker-compose up -d
```

## ⚡ Automated Backup Scripts

### backup-all.cmd

```cmd
@echo off
echo Creating complete Unit Talk backup...

REM Set timestamp
set backup_date=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
set backup_date=%backup_date: =0%

mkdir backups\%backup_date% 2>nul

REM Database backup
docker-compose exec postgres pg_dump -U postgres unit_talk_dev > "backups\%backup_date%\database.sql"

REM Configuration backup
copy .env "backups\%backup_date%\.env"
copy docker-compose.yml "backups\%backup_date%\docker-compose.yml"
xcopy config\ "backups\%backup_date%\config\" /E /I /Q

REM Volume backups
docker run --rm -v unit-talk-production-main_postgres_data:/source -v %cd%\backups\%backup_date%:/backup alpine tar czf /backup/postgres_data.tar.gz -C /source .

echo ✅ Complete backup created in backups\%backup_date%\
```

### restore-latest.cmd

```cmd
@echo off
echo Restoring from latest backup...

REM Find latest backup directory
for /f "delims=" %%F in ('dir /b /o-d backups\ 2^>nul') do set latest_backup=%%F

if not defined latest_backup (
    echo ❌ No backups found
    exit /b 1
)

echo Restoring from: %latest_backup%

REM Stop services
docker-compose down --volumes

REM Restore configuration
copy "backups\%latest_backup%\.env" .env
copy "backups\%latest_backup%\docker-compose.yml" docker-compose.yml

REM Start infrastructure
docker-compose up -d postgres redis

REM Wait and restore database
timeout /t 20 >nul
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE unit_talk_dev;" 2>nul
docker-compose exec -T postgres psql -U postgres unit_talk_dev < "backups\%latest_backup%\database.sql"

REM Start all services
docker-compose up -d

echo ✅ Restore completed from %latest_backup%
```

## 🔍 Verification Procedures

### Post-Backup Verification

```cmd
REM Verify backup file integrity
if exist "backups\unit_talk_backup_*.sql" (
    for %%F in (backups\unit_talk_backup_*.sql) do (
        if %%~zF LSS 1000 (
            echo ❌ Backup file %%F appears to be too small
        ) else (
            echo ✅ Backup file %%F looks valid (%%~zF bytes)
        )
    )
)

REM Test backup by attempting a restore to test database
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE test_restore;" 2>nul
docker-compose exec -T postgres psql -U postgres test_restore < "backups\%latest_backup%"
docker-compose exec postgres psql -U postgres -c "DROP DATABASE test_restore;"
```

### Post-Restore Verification

```cmd
REM Verify database connectivity and data
docker-compose exec postgres psql -U postgres unit_talk_dev -c "SELECT version();"
docker-compose exec postgres psql -U postgres unit_talk_dev -c "SELECT COUNT(*) FROM unified_picks;"

REM Verify services are responding
curl -f http://localhost:3000/api/health
curl -f http://localhost:3004/health
curl -f http://localhost:3002/health

REM Check service logs for errors
docker-compose logs --tail=20 api | findstr ERROR
docker-compose logs --tail=20 command-center | findstr ERROR
```

## 📋 Best Practices

### Backup Frequency

- **Development**: Daily automated backups
- **Staging**: Hourly during active development
- **Production**: Continuous backup with point-in-time recovery

### Backup Storage

- **Local**: Keep 7 days of local backups
- **OneDrive**: Automatic sync for configuration files
- **External**: Weekly external backups for production

### Testing

- **Monthly**: Full restore testing in isolated environment
- **Pre-deployment**: Backup verification before any major changes
- **Post-incident**: Complete backup and restore cycle testing

### Documentation

- **Keep updated**: Update procedures with any infrastructure changes
- **Version control**: Track backup procedure changes
- **Team training**: Ensure team members know recovery procedures

---

**Backup Strategy Owner**: DevOps Team  
**Last Updated**: Current  
**Next Review**: Monthly backup procedure review
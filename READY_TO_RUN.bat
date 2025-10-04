@echo off
REM READY TO RUN: Cloud E2E Execution Block (Windows)
REM Run this inside the repo root after filling in credentials

echo.
echo ===============================================================
echo    Cloud E2E Execution Starting
echo ===============================================================
echo.

REM Step 1: Stop any existing containers
echo Stopping existing containers...
docker-compose --profile cloud down 2>nul
docker-compose --profile local down 2>nul
docker-compose down 2>nul

REM Step 2: Start cloud profile services
echo Starting cloud profile services...
docker-compose --profile cloud up -d redis temporal temporal-ui prometheus grafana

REM Step 3: Start API with cloud profile
echo Starting API service (cloud mode)...
docker-compose --profile cloud up -d --force-recreate --no-deps api-cloud

REM Step 4: Wait for services to be healthy
echo Waiting for services to be healthy (30s)...
timeout /t 30 /nobreak >nul

REM Step 5: Verify no local DB leak
echo Verifying no local DB environment...
docker-compose --profile cloud exec -T api-cloud printenv 2>nul | findstr /I "DATABASE_URL" >nul
if %errorlevel% == 0 (
  echo ERROR: Local DB environment detected!
  echo    DATABASE_URL should NOT be present in cloud mode
  exit /b 1
) else (
  echo OK: No local DB environment detected
)

REM Step 6: Supabase login (interactive)
echo.
echo Supabase Login Required
echo    This will open your browser for authentication
pause
supabase logout 2>nul
supabase login

REM Step 7: Link to cloud project
echo.
echo Linking to Supabase Cloud project...
supabase link --project-ref lxqmuzmqtnnlpfapvief --local-config .supabase/config.cloud.toml

REM Step 8: Pull current schema
echo Pulling current schema...
supabase db pull --local-config .supabase/config.cloud.toml

REM Step 9: Push migrations
echo Pushing migrations to cloud...
supabase db push --local-config .supabase/config.cloud.toml

REM Step 10: Health check
echo.
echo Running database health check...
docker-compose --profile cloud exec -T api-cloud npm run db:health

REM Step 11: Run E2E
echo.
echo ===============================================================
echo    Running E2E Pipeline
echo ===============================================================
echo.
docker-compose --profile cloud exec -T api-cloud npm run e2e

REM Step 12: Review results
echo.
echo ===============================================================
echo    E2E Complete - Reviewing Results
echo ===============================================================
echo.
echo Acceptance Gates Summary:
echo.
type apps\api\out\ops\ACCEPTANCE_GATES_SUMMARY.md
echo.
echo Done! Check apps/api/out/ops/ for all artifacts
echo.
pause

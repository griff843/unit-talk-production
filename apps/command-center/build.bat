@echo off
echo Building Unit Talk Command Center...

REM Set environment variables
set NEXT_TELEMETRY_DISABLED=1
set NODE_ENV=production

REM Clean previous builds
echo Cleaning previous builds...
if exist .next\ (
    echo Removing .next directory...
    rmdir /s /q .next 2>nul
)

if exist build\ (
    echo Removing build directory...
    rmdir /s /q build 2>nul
)

REM Create build with timeout
echo Starting build process...
timeout /t 2 /nobreak >nul

REM Run the build
call npm run build:windows

echo Build complete!
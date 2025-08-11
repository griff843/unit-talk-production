@echo off
title Unit Talk Command Center Launcher
echo ============================================
echo Starting Unit Talk Command Center
echo ============================================
echo.

REM Navigate to Command Center and run
echo Navigating to Command Center directory...
cd /d "..\unit-talk-command-center"

echo Current directory: %CD%
echo.

echo Starting Next.js development server on port 3002...
echo URL: http://localhost:3002
echo Press Ctrl+C to stop the server
echo.

REM Use the local node_modules to run next
node_modules\.bin\next dev -p 3002
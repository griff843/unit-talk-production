@echo off
echo ============================================
echo Installing WSL2 with Ubuntu on Windows
echo ============================================
echo.
echo This will install:
echo - WSL2 (Windows Subsystem for Linux)
echo - Ubuntu 22.04 LTS
echo - Windows Terminal (recommended)
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause > nul

REM Enable WSL and install Ubuntu
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList 'wsl --install -d Ubuntu'"

echo.
echo ============================================
echo Installation Started!
echo ============================================
echo.
echo After Windows restarts:
echo 1. Ubuntu will open automatically
echo 2. Create a username and password
echo 3. Run: cd /mnt/c/Users/%USERNAME%/Desktop/"Unit Talk Production v3"/unit-talk-production
echo 4. Run: ./setup-wsl-dev.sh
echo.
pause
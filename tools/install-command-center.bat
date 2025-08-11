@echo off
echo ============================================
echo Installing Unit Talk Command Center
echo ============================================
echo.

cd ..
cd unit-talk-command-center

echo Installing dependencies...
npm install

echo.
echo Creating .env.local...
if not exist ".env.local" (
    echo NEXT_PUBLIC_SUPABASE_URL=https://sqdxvtztjczklmqckmwl.supabase.co > .env.local
    echo NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZHh2dHp0amN6a2xtcWNrbXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjEyNzQzMjEsImV4cCI6MjAzNjg1MDMyMX0.BYRwJKNdI5JGN5gfzH4dNvzgPZNLlGwEhsN6RnPaMI8 >> .env.local
    echo NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:3004 >> .env.local
    echo NEXT_PUBLIC_PHASE_D_URL=http://localhost:3005 >> .env.local
    echo.
    echo .env.local created successfully!
)

echo.
echo ============================================
echo Command Center Installation Complete!
echo ============================================
echo.
echo To start the Command Center:
echo 1. npm run dev
echo.
echo Command Center will be available at:
echo http://localhost:3002
echo.
pause
@echo off
npx tsc --noEmit 2>&1 | findstr "error TS" | find /c "error TS"